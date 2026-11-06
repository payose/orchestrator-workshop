import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixtureInference, FixtureEvidenceDb } from '../src/fixtures.js';
import { runIncident } from '../src/orchestrate.js';
import { MemoryIncidentStore } from '../src/store.js';
import { buildTools } from '../src/tools.js';

const slices = [
  { key: 'telemetry', task: 'Telemetry specialist: count errors.', tools: ['getErrorRate', 'queryQuoteEvents'] },
  { key: 'deployment', task: 'Deployment specialist: identify the release.', tools: ['listDeployments'] },
];

test('workers fork concurrently and partial results survive failure', async () => {
  const result = await runIncident({
    store: new MemoryIncidentStore(),
    infer: createFixtureInference({ failDeployment: true }),
    readTools: buildTools(new FixtureEvidenceDb()),
    objective: 'Investigate',
    dedupeKey: 'partial-test',
    slices,
  });
  assert.equal(result.executionMode, 'concurrent');
  assert.equal(result.runStatus, 'partial');
  assert.equal(result.workers.find((worker) => worker.key === 'telemetry')?.status, 'succeeded');
  assert.equal(result.workers.find((worker) => worker.key === 'deployment')?.status, 'failed');
});

test('the same dedupe key does not start a second run', async () => {
  const store = new MemoryIncidentStore();
  const input = { store, infer: createFixtureInference(), readTools: buildTools(new FixtureEvidenceDb()), objective: 'Investigate', dedupeKey: 'dedupe-test', slices };
  const first = await runIncident(input);
  const second = await runIncident(input);
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
});
