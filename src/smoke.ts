import assert from 'node:assert/strict';
import { createFixtureInference, FixtureEvidenceDb, REQUEST_A, REQUEST_B } from './fixtures.js';
import { buildTools } from './tools.js';
import { MemoryIncidentStore } from './store.js';
import { runIncident } from './orchestrate.js';
import { verifyTelemetry } from './verify.js';
import { SimulatedRemediation } from './remediation.js';
import { runFullWorkflow } from './workflow.js';

function pass(stage: string, detail: string): void {
  console.log(`\n[${stage}] PASS — ${detail}`);
}

function state(message: string): void {
  console.log(`  ${message}`);
}

console.log('Fork, Delegate, Merge — fixture smoke test');
console.log('This runs the demonstration path end to end with seeded evidence.');
console.log('The delegation TODO remains a separate hands-on exercise.');

const db = new FixtureEvidenceDb();

const fork = await runIncident({
  store: new MemoryIncidentStore(),
  infer: createFixtureInference({ failDeployment: true }),
  readTools: buildTools(db),
  objective: 'Smoke test the incident investigation.',
  context: 'Priority orders fail while standard orders succeed.',
  dedupeKey: 'smoke-fork',
  slices: [
    { key: 'telemetry', task: 'Telemetry specialist: count errors and identify failing requests.', tools: ['getErrorRate', 'queryQuoteEvents'] },
    { key: 'deployment', task: 'Deployment specialist: identify the release associated with the incident.', tools: ['listDeployments'] },
  ],
  onEvent: (event) => {
    if (event.type === 'worker_status') state(`${event.key} → ${event.status}`);
  },
});
assert.equal(fork.runStatus, 'partial');
assert.equal(fork.workers.find((worker) => worker.key === 'telemetry')?.status, 'succeeded');
assert.equal(fork.workers.find((worker) => worker.key === 'deployment')?.status, 'failed');
pass('1/4 fork', 'telemetry survived a failed deployment specialist and the run was graded partial');

const mergeClaim = `Failures: ${REQUEST_A} standard 500. ${REQUEST_B} priority 500.`;
const mergeVerdicts = await verifyTelemetry(db, mergeClaim);
assert.ok(mergeVerdicts.some((verdict) => verdict.status === 'contradicted'));
assert.ok(mergeVerdicts.some((verdict) => verdict.status === 'verified'));
pass('2/4 merge', 'worker claims were checked against evidence and a contradiction was surfaced');

const approval = new SimulatedRemediation();
const action = approval.propose('11111111-1111-4111-8111-111111111111', 'Restore the verified healthy release.');
assert.throws(() => approval.execute(action.actionId), /expected approved/);
approval.approve(action.actionId, 'incident-commander');
assert.equal(approval.execute(action.actionId).status, 'executed');
assert.equal(approval.verify(action.actionId).status, 'recovered');
pass('3/4 approval', 'execution was blocked before approval, then the rollback and recovery were simulated');

const full = await runFullWorkflow({
  db: new FixtureEvidenceDb(),
  infer: createFixtureInference(),
  dedupeKey: 'smoke-full',
  onEvent: (event) => {
    if (event.type === 'investigation_started') state('incident detected → investigation started');
    if (event.type === 'investigation_graded') state(`findings verified → assessment ${event.status}`);
  },
});
assert.equal(full.investigation.runStatus, 'succeeded');
assert.equal(full.investigation.confidence, 1);
assert.equal(full.executedProposal.status, 'executed');
assert.equal(full.recovery.status, 'recovered');
pass('4/4 full incident', 'detection, fork, verification, approval, simulated rollback, and recovery completed');

console.log('\nSmoke test complete — workshop fixture path is healthy.');
