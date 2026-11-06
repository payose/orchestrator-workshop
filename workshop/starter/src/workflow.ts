import type { InferResult, ChatMessage, ToolSchema } from './agent.js';
import { buildTools, type QueryableDb } from './tools.js';
import { MemoryIncidentStore } from './store.js';
import type { IncidentStore } from './store.js';
import { runIncident, type IncidentResult, type OrchestratorEvent } from './orchestrate.js';
import { BROKEN_VERSION, HEALTHY_VERSION } from './fixtures.js';
import { SimulatedRemediation, type RemediationAction } from './remediation.js';

export interface FullWorkflowResult {
  investigation: IncidentResult;
  proposal: RemediationAction;
  rejectedProposal: RemediationAction;
  approvedProposal: RemediationAction;
  executedProposal: RemediationAction;
  recovery: RemediationAction;
}

export async function runFullWorkflow(input: {
  db: QueryableDb;
  infer: (messages: ChatMessage[], tools: ToolSchema[]) => Promise<InferResult>;
  dedupeKey: string;
  store?: IncidentStore;
  onEvent?: (event: OrchestratorEvent) => void;
}): Promise<FullWorkflowResult> {
  const investigation = await runIncident({
    store: input.store ?? new MemoryIncidentStore(),
    infer: input.infer,
    readTools: buildTools(input.db),
    objective: 'Investigate why priority orders return HTTP 500 while standard orders continue to succeed.',
    context: 'Incident: priority orders are returning HTTP 500 while standard orders continue to succeed. Inspect the seeded evidence.',
    dedupeKey: input.dedupeKey,
    slices: [
      { key: 'telemetry', task: 'Telemetry specialist: count errors and identify failing requests.', tools: ['getErrorRate', 'queryQuoteEvents'] },
      { key: 'deployment', task: 'Deployment specialist: identify the release associated with the incident.', tools: ['listDeployments'] },
    ],
    evidenceDb: input.db,
    onEvent: input.onEvent,
  });

  const remediation = new SimulatedRemediation();
  const proposal = remediation.propose(HEALTHY_VERSION, `Verified priority failures correlate with broken deployment ${BROKEN_VERSION}; restore healthy-01.`);
  const rejectedProposal = remediation.reject(proposal.actionId, 'reviewer-1', 'Need a second operator to confirm the target version.');
  const approved = remediation.propose(HEALTHY_VERSION, `Verified priority failures correlate with broken deployment ${BROKEN_VERSION}; restore healthy-01.`);
  const approvedProposal = { ...remediation.approve(approved.actionId, 'incident-commander') };
  const executed = { ...remediation.execute(approvedProposal.actionId) };
  const recovery = remediation.verify(executed.actionId);
  return { investigation, proposal, rejectedProposal, approvedProposal, executedProposal: executed, recovery };
}
