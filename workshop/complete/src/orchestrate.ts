import { runAgent, type AgentTool, type ChatMessage, type InferResult, type ToolSchema } from './agent.js';
import type { IncidentStore, RunState } from './store.js';
import type { QueryableDb } from './tools.js';
import { buildAssessment, confidenceOf, verifyDeployment, verifyTelemetry, type Assessment, type WorkerVerdicts } from './verify.js';

export interface WorkerSlice {
  key: string;
  task: string;
  context?: string;
  tools: string[];
  maxSteps?: number;
  timeoutMs?: number;
}

export interface WorkerOutcome {
  key: string;
  taskId: string;
  agentId: string;
  status: 'succeeded' | 'failed' | 'timed_out';
  stepsUsed: number | null;
  conclusion: string | null;
  confidence: number | null;
}

export interface IncidentResult {
  incidentId: string;
  runId: string | null;
  deduplicated: boolean;
  workers: WorkerOutcome[];
  runStatus: RunState | 'duplicate';
  executionMode: 'sequential' | 'concurrent';
  elapsedMs: number;
  confidence: number | null;
  assessment: Assessment;
  verdicts: WorkerVerdicts[];
}

export type OrchestratorEvent =
  | { type: 'investigation_started'; objective: string; mode: 'sequential' | 'concurrent' }
  | { type: 'worker_status'; key: string; status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMED_OUT' }
  | { type: 'investigation_graded'; status: RunState; confidence: number | null };

export interface OrchestrateOptions {
  store: IncidentStore;
  infer: (messages: ChatMessage[], tools: ToolSchema[]) => Promise<InferResult>;
  readTools: AgentTool[];
  objective: string;
  context?: string;
  dedupeKey: string;
  slices: WorkerSlice[];
  defaultTimeoutMs?: number;
  executionMode?: 'sequential' | 'concurrent';
  evidenceDb?: QueryableDb;
  onEvent?: (event: OrchestratorEvent) => void;
}

function withTimeout<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Worker timed out after ${ms}ms`)), ms); });
  return Promise.race([operation, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

export async function runIncident(options: OrchestrateOptions): Promise<IncidentResult> {
  const startedAt = Date.now();
  const now = () => new Date().toISOString();
  const executionMode = options.executionMode ?? 'concurrent';
  const { store, infer, readTools, objective, context, dedupeKey, slices } = options;
  options.onEvent?.({ type: 'investigation_started', objective, mode: executionMode });

  const existing = await store.findIncidentByDedupe(dedupeKey);
  if (existing) return {
    incidentId: existing.incident_id,
    runId: null,
    deduplicated: true,
    workers: [],
    runStatus: 'duplicate',
    executionMode,
    elapsedMs: Date.now() - startedAt,
    confidence: null,
    assessment: { known: [], uncertain: [], next: [] },
    verdicts: [],
  };

  const incidentId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  await store.createIncident(incidentId, dedupeKey, objective, now());
  await store.createRun(runId, incidentId, now());
  const parentId = crypto.randomUUID();
  await store.createAgent({ agent_id: parentId, run_id: runId, task_id: null, role: 'parent', task: objective, parent_agent_id: null }, now());
  await store.setAgentState(parentId, 'running', now());

  const prepared: Array<{ slice: WorkerSlice; taskId: string; agentId: string }> = [];
  for (const slice of slices) {
    const taskId = crypto.randomUUID();
    const agentId = crypto.randomUUID();
    await store.createTask({ task_id: taskId, run_id: runId, task_key: slice.key, description: slice.task }, now());
    await store.createAgent({ agent_id: agentId, run_id: runId, task_id: taskId, role: 'worker', task: slice.task, parent_agent_id: parentId }, now());
    prepared.push({ slice, taskId, agentId });
  }

  const runWorker = async ({ slice, taskId, agentId }: (typeof prepared)[number]): Promise<WorkerOutcome> => {
    options.onEvent?.({ type: 'worker_status', key: slice.key, status: 'RUNNING' });
    await store.setTaskState(taskId, 'running', now());
    await store.setAgentState(agentId, 'running', now());
    const subset = readTools.filter((tool) => slice.tools.includes(tool.schema.name));
    if (!subset.length) {
      const note = 'No valid tools selected for this worker.';
      await store.finishTask(taskId, 'failed', now());
      await store.finishAgent(agentId, 'failed', null, note, now());
      options.onEvent?.({ type: 'worker_status', key: slice.key, status: 'FAILED' });
      return { key: slice.key, taskId, agentId, status: 'failed', stepsUsed: null, conclusion: note, confidence: null };
    }
    const recordCall = async (event: { step: number; tool: string; args: unknown; ok: boolean; output?: unknown; error?: string }) => {
      await store.recordToolCall({ agent_id: agentId, step: event.step, tool_name: event.tool, args_json: JSON.stringify(event.args ?? null), ok: event.ok, output_json: event.ok ? JSON.stringify(event.output ?? null).slice(0, 4000) : null, error_text: event.ok ? null : event.error ?? 'Unknown error' }, now());
    };
    try {
      const report = await withTimeout(runAgent({ objective: slice.task, context: slice.context ?? context, tools: subset, maxSteps: slice.maxSteps ?? 6, infer, onToolResult: recordCall }), slice.timeoutMs ?? options.defaultTimeoutMs ?? 120_000);
      const status = report.status === 'answered' ? 'succeeded' : 'failed';
      await store.finishTask(taskId, status, now());
      await store.finishAgent(agentId, status, report.stepsUsed, report.finalAnswer, now());
      options.onEvent?.({ type: 'worker_status', key: slice.key, status: status === 'succeeded' ? 'SUCCESS' : 'FAILED' });
      return { key: slice.key, taskId, agentId, status, stepsUsed: report.stepsUsed, conclusion: report.finalAnswer, confidence: null };
    } catch (error) {
      const note = error instanceof Error ? error.message : String(error);
      const status = note.includes('timed out') ? 'timed_out' : 'failed';
      await store.finishTask(taskId, status, now());
      await store.finishAgent(agentId, status, null, note, now());
      options.onEvent?.({ type: 'worker_status', key: slice.key, status: status === 'timed_out' ? 'TIMED_OUT' : 'FAILED' });
      return { key: slice.key, taskId, agentId, status, stepsUsed: null, conclusion: note, confidence: null };
    }
  };

  let settled: PromiseSettledResult<WorkerOutcome>[];
  if (executionMode === 'sequential') {
    settled = [];
    for (const item of prepared) settled.push({ status: 'fulfilled', value: await runWorker(item) });
  } else {
    settled = await Promise.allSettled(prepared.map(runWorker));
  }

  const workers = settled.map((entry, index): WorkerOutcome => {
    const slice = slices[index] as WorkerSlice;
    const item = prepared[index];
    if (entry.status === 'fulfilled') return entry.value;
    return { key: slice.key, taskId: item?.taskId ?? 'unknown', agentId: item?.agentId ?? 'unknown', status: 'failed', stepsUsed: null, conclusion: String(entry.reason), confidence: null };
  });
  const succeeded = workers.filter((worker) => worker.status === 'succeeded').length;
  const executionGrade: RunState = succeeded === workers.length ? 'succeeded' : succeeded ? 'partial' : 'failed';

  const workerVerdicts: WorkerVerdicts[] = [];
  if (options.evidenceDb) {
    for (const worker of workers) {
      if (worker.status !== 'succeeded' || !worker.conclusion) continue;
      const verdicts = await (worker.key === 'deployment' ? verifyDeployment : verifyTelemetry)(options.evidenceDb, worker.conclusion);
      const confidence = confidenceOf(verdicts);
      worker.confidence = confidence;
      workerVerdicts.push({ workerKey: worker.key, taskId: worker.taskId, agentId: worker.agentId, verdicts, confidence });
      for (const verdict of verdicts) await store.recordVerdict({ run_id: runId, task_id: worker.taskId, agent_id: worker.agentId, worker_key: worker.key, claim: verdict.claim, kind: verdict.kind, status: verdict.status, detail: verdict.detail }, now());
    }
  }
  const allVerdicts = workerVerdicts.flatMap((worker) => worker.verdicts);
  const confidence = allVerdicts.length ? confidenceOf(allVerdicts) : null;
  const assessment = buildAssessment(workerVerdicts);
  const confidenceGrade: RunState | null = confidence === null ? null : confidence >= 0.8 ? 'succeeded' : confidence >= 0.5 ? 'partial' : 'failed';
  const rank: Record<RunState, number> = { failed: 0, partial: 1, running: 1, succeeded: 2 };
  const runStatus = confidenceGrade === null || rank[confidenceGrade] >= rank[executionGrade] ? executionGrade : confidenceGrade;
  await store.finishRun(runId, runStatus, now());
  await store.setRunVerification(runId, { confidence, assessmentJson: JSON.stringify(assessment) }, now());
  await store.finishAgent(parentId, runStatus === 'failed' ? 'failed' : 'succeeded', null, null, now());
  options.onEvent?.({ type: 'investigation_graded', status: runStatus, confidence });
  return { incidentId, runId, deduplicated: false, workers, runStatus, executionMode, elapsedMs: Date.now() - startedAt, confidence, assessment, verdicts: workerVerdicts };
}
