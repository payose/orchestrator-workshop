import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runAgent, type AgentTool, type ChatMessage, type InferResult, type ToolSchema } from '../src/agent.js';

function scripted(script: InferResult[]) {
  let index = 0;
  return async (_messages: ChatMessage[], _tools: ToolSchema[]): Promise<InferResult> => script[index++] ?? script.at(-1)!;
}

const tool: AgentTool = { schema: { name: 'read', description: 'Read', parameters: {} }, run: async () => ({ ok: true }) };

test('runAgent returns an answer after a tool observation', async () => {
  const report = await runAgent({ objective: 'Inspect', tools: [tool], infer: scripted([{ kind: 'tool', name: 'read', args: {} }, { kind: 'answer', text: 'done' }]) });
  assert.equal(report.status, 'answered');
  assert.equal(report.stepsUsed, 2);
  assert.equal(report.finalAnswer, 'done');
});

test('runAgent turns unknown tools into observations', async () => {
  const report = await runAgent({ objective: 'Inspect', tools: [tool], infer: scripted([{ kind: 'tool', name: 'missing', args: {} }, { kind: 'answer', text: 'continue' }]) });
  assert.match(report.messages.at(-2)?.content ?? '', /Unknown tool/);
});
