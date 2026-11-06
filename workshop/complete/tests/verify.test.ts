import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FixtureEvidenceDb, REQUEST_A, REQUEST_B } from '../src/fixtures.js';
import { confidenceOf, verifyTelemetry } from '../src/verify.js';

test('verification catches a contradiction in a worker claim', async () => {
  const db = new FixtureEvidenceDb();
  const verdicts = await verifyTelemetry(db, `Failures: ${REQUEST_A} standard 500. ${REQUEST_B} priority 500.`);
  assert.equal(verdicts.filter((verdict) => verdict.status === 'contradicted').length, 1);
  assert.equal(verdicts.filter((verdict) => verdict.status === 'verified').length, 1);
});

test('confidence is null when there are no checkable claims', () => {
  assert.equal(confidenceOf([]), null);
});
