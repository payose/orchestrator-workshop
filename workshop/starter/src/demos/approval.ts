import { HEALTHY_VERSION } from '../fixtures.js';
import { SimulatedRemediation } from '../remediation.js';
import { heading, line } from './shared.js';

heading('Demo 3 — Human approval');
const remediation = new SimulatedRemediation();
const rejected = remediation.propose(HEALTHY_VERSION, 'Restore the last healthy deployment after verified priority failures.');
console.log(`[remediation] PROPOSED rollback to ${rejected.targetVersionId}`);
try {
  remediation.execute(rejected.actionId);
} catch (error) {
  console.log(`[authorization] EXECUTION BLOCKED before approval — ${(error as Error).message}`);
}
line('[operator] rejected', remediation.reject(rejected.actionId, 'reviewer-1', 'The target needs a second review.'));

const approved = remediation.propose(HEALTHY_VERSION, 'Restore the last healthy deployment after verified priority failures.');
console.log(`[remediation] PROPOSED rollback to ${approved.targetVersionId}`);
line('[operator] approved', remediation.approve(approved.actionId, 'incident-commander'));
line('[remediation] simulated execution', remediation.execute(approved.actionId));
line('[recovery] verified', remediation.verify(approved.actionId));
console.log('[lesson] Approval is the authorization boundary; execution is simulated after approval.');
