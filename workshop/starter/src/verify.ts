import type { QueryableDb } from './tools.js';

export type VerdictStatus = 'verified' | 'contradicted' | 'not_found' | 'uncheckable';
export type ClaimKind = 'request_row' | 'aggregate' | 'deployment';

export interface ClaimVerdict {
  claim: string;
  kind: ClaimKind;
  status: VerdictStatus;
  detail: string;
}

export interface EvidenceRow {
  request_id: string;
  order_type: string;
  http_status: number | null;
  release_label: string | null;
}

export interface DeploymentRow {
  version_id: string;
  release_label: string;
  variant: string;
}

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function normalizeText(text: string): string {
  return text.replace(/[\u2010\u2011\u2212\uFE58\uFE63\uFF0D]/g, '-');
}

export function extractIds(text: string): string[] {
  const seen = new Set<string>();
  return (text.match(UUID_RE) ?? []).map((id) => id.toLowerCase()).filter((id) => !seen.has(id) && seen.add(id));
}

function windowAround(text: string, id: string, allIds: string[], radius = 200): string {
  const lower = text.toLowerCase();
  const at = lower.indexOf(id);
  if (at === -1) return '';
  const positions = allIds.map((other) => ({ id: other, index: lower.indexOf(other) })).filter((item) => item.index !== -1).sort((a, b) => a.index - b.index);
  const next = positions.find((item) => item.index > at);
  const start = at;
  const end = Math.min(next?.index ?? text.length, at + id.length + radius);
  return text.slice(start, end).toLowerCase();
}

async function lookupRequest(db: QueryableDb, requestId: string): Promise<EvidenceRow | null> {
  const { results } = await db.prepare('SELECT request_id, order_type, http_status, release_label FROM quote_events WHERE request_id = ?').bind(requestId).all<EvidenceRow>();
  return results[0] ?? null;
}

async function lookupDeployment(db: QueryableDb, versionId: string): Promise<DeploymentRow | null> {
  const { results } = await db.prepare('SELECT version_id, release_label, variant FROM deployments WHERE version_id = ?').bind(versionId).all<DeploymentRow>();
  return results[0] ?? null;
}

function checkRequest(id: string, row: EvidenceRow | null, nearby: string): ClaimVerdict {
  const short = id.slice(0, 8);
  if (!row) return { claim: `request ${short} failed`, kind: 'request_row', status: 'not_found', detail: `No row for ${id} exists in quote_events.` };
  const claimedOrder = nearby.includes('standard') ? 'standard' : nearby.includes('priority') ? 'priority' : null;
  if (claimedOrder && claimedOrder !== row.order_type) {
    return { claim: `request ${short} is ${claimedOrder}`, kind: 'request_row', status: 'contradicted', detail: `Conclusion says ${claimedOrder}; evidence says ${row.order_type} with HTTP ${row.http_status}.` };
  }
  if ((nearby.includes('500') || nearby.includes('5xx') || nearby.includes('fail')) && row.http_status !== null && row.http_status < 500) {
    return { claim: `request ${short} failed`, kind: 'request_row', status: 'contradicted', detail: `Conclusion presents a failure; evidence says HTTP ${row.http_status}.` };
  }
  return { claim: `request ${short} is ${row.order_type} ${row.http_status}`, kind: 'request_row', status: 'verified', detail: `Evidence row exists: ${row.order_type}, HTTP ${row.http_status}, release ${row.release_label}.` };
}

async function actualAggregates(db: QueryableDb): Promise<{ total: number; http5xx: number; errorRate: number | null }> {
  const { results } = await db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN http_status >= 500 THEN 1 ELSE 0 END) AS http5xx, SUM(CASE WHEN http_status IS NULL THEN 1 ELSE 0 END) AS transportUnknown FROM quote_events').bind().all<{ total: number; http5xx: number; transportUnknown: number }>();
  const row = results[0] ?? { total: 0, http5xx: 0, transportUnknown: 0 };
  const completed = row.total - row.transportUnknown;
  return { total: row.total, http5xx: row.http5xx, errorRate: completed ? row.http5xx / completed : null };
}

function numberNear(pattern: RegExp, text: string): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

async function checkAggregates(db: QueryableDb, text: string): Promise<ClaimVerdict[]> {
  const actual = await actualAggregates(db);
  const lower = text.toLowerCase();
  const verdicts: ClaimVerdict[] = [];
  const total = numberNear(/\|\s*\*{0,2}total requests\*{0,2}\s*\|\s*\*{0,2}(\d+)/, lower);
  if (total !== null) verdicts.push(total === actual.total
    ? { claim: `total requests = ${total}`, kind: 'aggregate', status: 'verified', detail: `Matches evidence count ${actual.total}.` }
    : { claim: `total requests = ${total}`, kind: 'aggregate', status: 'contradicted', detail: `Evidence count is ${actual.total}.` });
  const fiveHundred = numberNear(/\|\s*\*{0,2}(?:http\s*)?5xx(?: errors)?\*{0,2}\s*\|\s*\*{0,2}(\d+)/, lower);
  if (fiveHundred !== null) verdicts.push(fiveHundred === actual.http5xx
    ? { claim: `HTTP 5xx errors = ${fiveHundred}`, kind: 'aggregate', status: 'verified', detail: `Matches evidence count ${actual.http5xx}.` }
    : { claim: `HTTP 5xx errors = ${fiveHundred}`, kind: 'aggregate', status: 'contradicted', detail: `Evidence count is ${actual.http5xx}.` });
  const rate = numberNear(/error rate\D{0,40}([\d.]+)/, lower);
  if (rate !== null && actual.errorRate !== null) {
    const normalized = rate > 1 ? rate / 100 : rate;
    const close = Math.abs(normalized - actual.errorRate) <= 0.02;
    verdicts.push(close
      ? { claim: `error rate ≈ ${rate}`, kind: 'aggregate', status: 'verified', detail: `Within tolerance of ${actual.errorRate.toFixed(3)}.` }
      : { claim: `error rate ≈ ${rate}`, kind: 'aggregate', status: 'contradicted', detail: `Evidence rate is ${actual.errorRate.toFixed(3)}.` });
  }
  return verdicts;
}

export async function verifyTelemetry(db: QueryableDb, conclusion: string): Promise<ClaimVerdict[]> {
  const text = normalizeText(conclusion);
  const ids = extractIds(text);
  const verdicts: ClaimVerdict[] = [];
  for (const id of ids) verdicts.push(checkRequest(id, await lookupRequest(db, id), windowAround(text, id, ids)));
  verdicts.push(...await checkAggregates(db, text));
  return verdicts;
}

export async function verifyDeployment(db: QueryableDb, conclusion: string): Promise<ClaimVerdict[]> {
  const text = normalizeText(conclusion);
  const ids = extractIds(text);
  const verdicts: ClaimVerdict[] = [];
  for (const id of ids) {
    const row = await lookupDeployment(db, id);
    const short = id.slice(0, 8);
    if (!row) {
      verdicts.push({ claim: `version ${short} deployed`, kind: 'deployment', status: 'not_found', detail: `No deployment row exists for ${id}.` });
      continue;
    }
    const nearby = windowAround(text, id, ids);
    const labelLike = nearby.match(/healthy-\d+|broken-\d+/)?.[0];
    verdicts.push(labelLike && labelLike !== row.release_label
      ? { claim: `version ${short} is ${labelLike}`, kind: 'deployment', status: 'contradicted', detail: `Evidence says release ${row.release_label}.` }
      : { claim: `version ${short} is ${row.release_label}`, kind: 'deployment', status: 'verified', detail: `Deployment exists with variant ${row.variant}.` });
  }
  return verdicts;
}

export function confidenceOf(verdicts: ClaimVerdict[]): number | null {
  const checked = verdicts.filter((verdict) => verdict.status !== 'uncheckable');
  if (!checked.length) return null;
  return checked.filter((verdict) => verdict.status === 'verified').length / checked.length;
}

export interface Assessment { known: string[]; uncertain: string[]; next: string[]; }
export interface WorkerVerdicts { workerKey: string; taskId: string; agentId: string; verdicts: ClaimVerdict[]; confidence: number | null; }

export function buildAssessment(workers: WorkerVerdicts[]): Assessment {
  const known: string[] = [];
  const uncertain: string[] = [];
  for (const worker of workers) for (const verdict of worker.verdicts) {
    if (verdict.status === 'verified') known.push(`[${worker.workerKey}] ${verdict.claim}.`);
    if (verdict.status === 'contradicted' || verdict.status === 'not_found') uncertain.push(`[${worker.workerKey}] UNCERTAIN: ${verdict.claim} — ${verdict.detail}`);
  }
  const unsupported = workers.reduce((sum, worker) => sum + worker.verdicts.filter((verdict) => verdict.status !== 'verified' && verdict.status !== 'uncheckable').length, 0);
  const next = unsupported ? [`Treat ${unsupported} worker claim${unsupported === 1 ? '' : 's'} as unsupported and re-query the evidence before acting.`] : [];
  if (workers.some((worker) => worker.verdicts.some((verdict) => verdict.status === 'verified' && verdict.kind === 'request_row'))) next.push('Correlate verified failing requests with the deployment timeline.');
  if (!known.length && !uncertain.length) next.push('No mechanical claims were checkable; inspect the evidence manually.');
  return { known, uncertain, next };
}
