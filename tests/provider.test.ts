import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAiReply } from '../src/provider.js';

test('Workers AI tool calls normalize JSON arguments', () => {
  const result = parseAiReply({ choices: [{ message: { tool_calls: [{ function: { name: 'read', arguments: '{"x":1}' } }] } }] });
  assert.deepEqual(result, { kind: 'tool', name: 'read', args: { x: 1 } });
});
