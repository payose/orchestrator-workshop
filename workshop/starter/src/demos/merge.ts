import { FixtureEvidenceDb, REQUEST_A, REQUEST_B } from '../fixtures.js';
import { buildAssessment, confidenceOf, verifyTelemetry } from '../verify.js';
import { heading, line } from './shared.js';

heading('Demo 2 — Merge');
const db = new FixtureEvidenceDb();
const claimedFinding = `Failures: ${REQUEST_A} standard 500. ${REQUEST_B} priority 500.`;
console.log('[worker] Claimed finding');
console.log(claimedFinding);
console.log('[verifier] Evidence lookup');
line(`[evidence] ${REQUEST_A}`, db.request(REQUEST_A));
line(`[evidence] ${REQUEST_B}`, db.request(REQUEST_B));
const verdicts = await verifyTelemetry(db, claimedFinding);
for (const verdict of verdicts) console.log(`[verifier] ${verdict.status.toUpperCase()} — ${verdict.claim} — ${verdict.detail}`);
console.log('[merge] Verification complete; building the assessment from those verdicts.');
const assessment = buildAssessment([{
  workerKey: 'telemetry',
  taskId: 'demo-telemetry-task',
  agentId: 'demo-telemetry-agent',
  verdicts,
  confidence: confidenceOf(verdicts),
}]);
line('[merge] known', assessment.known);
line('[merge] uncertain', assessment.uncertain);
line('[merge] next', assessment.next);
console.log('[lesson] Merge preserves verified claims, labels contradictions as uncertain, and produces next actions.');
