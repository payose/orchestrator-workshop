import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimulatedRemediation } from '../src/remediation.js';

test('simulated remediation requires approval before execution', () => {
  const service = new SimulatedRemediation();
  const action = service.propose('healthy-01', 'Restore the verified healthy release.');
  assert.throws(() => service.execute(action.actionId), /expected approved/);
  service.approve(action.actionId, 'operator');
  assert.equal(service.execute(action.actionId).status, 'executed');
  assert.equal(service.verify(action.actionId).status, 'recovered');
});
