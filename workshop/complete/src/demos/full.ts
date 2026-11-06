import { createFixtureInference, FixtureEvidenceDb } from '../fixtures.js';
import { runFullWorkflow } from '../workflow.js';
import { heading, line } from './shared.js';

heading('Demo 4 — Full incident');
console.log('[incident] DETECTED — priority orders are returning HTTP 500 while standard orders continue to succeed.');
const result = await runFullWorkflow({
  db: new FixtureEvidenceDb(),
  infer: createFixtureInference(),
  dedupeKey: 'demo-full',
  onEvent: (event) => {
    if (event.type === 'investigation_started') console.log('[orchestrator] Starting investigation');
    if (event.type === 'worker_status') console.log(`[${event.key}] ${event.status}`);
    if (event.type === 'investigation_graded') console.log(`[orchestrator] Investigation ${event.status}; confidence=${event.confidence ?? 'n/a'}`);
  },
});
console.log('[orchestrator] Findings verified and merged');
line('[assessment] known', result.investigation.assessment.known);
line('[assessment] uncertain', result.investigation.assessment.uncertain);
console.log(`[remediation] PROPOSED rollback to ${result.proposal.targetVersionId}`);
console.log(`[authorization] REJECTED first proposal — status=${result.rejectedProposal.status}`);
console.log(`[authorization] APPROVED by ${result.approvedProposal.approvedBy}`);
console.log(`[remediation] SIMULATED rollback — status=${result.executedProposal.status}`);
console.log(`[recovery] VERIFIED — status=${result.recovery.status}`);
