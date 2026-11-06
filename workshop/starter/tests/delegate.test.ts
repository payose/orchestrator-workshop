import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runAgent, type AgentTool, type ChatMessage, type InferResult, type ToolSchema } from '../src/agent.js';
import { buildDelegateTool } from '../src/delegate.js';

const readTool: AgentTool = { schema: { name: 'listDeployments', description: 'Read deployments', parameters: {} }, run: async () => [{ version_id: 'healthy' }] };

function scripted(script: InferResult[]) {
  let index = 0;
  return async (_messages: ChatMessage[], _tools: ToolSchema[]): Promise<InferResult> => script[index++] ?? script.at(-1)!;
}

test('delegation returns a worker conclusion without its transcript', async () => {
  const infer = scripted([
    { kind: 'tool', name: 'delegate', args: { task: 'Check deployments', tools: ['listDeployments'] } },
    { kind: 'answer', text: 'Worker says broken.' },
    { kind: 'answer', text: 'Parent merged the finding.' },
  ]);
  const delegate = buildDelegateTool({ infer, allTools: [readTool] });
  const report = await runAgent({ objective: 'Investigate', tools: [delegate], infer });
  assert.equal(report.finalAnswer, 'Parent merged the finding.');
  assert.match(report.messages.find((message) => message.role === 'tool')?.content ?? '', /Worker says broken/);
  assert.doesNotMatch(report.messages.find((message) => message.role === 'tool')?.content ?? '', /version_id/);
});

test('delegated workers receive only their selected tools and cannot recurse', async () => {
  const delegate = buildDelegateTool({
    allTools: [readTool],
    infer: scripted([{ kind: 'tool', name: 'delegate', args: { task: 'Nested' } }, { kind: 'answer', text: 'No nested delegation.' }]),
  });
  const result = await delegate.run({ task: 'Outer', tools: ['listDeployments'] }) as { conclusion: string };
  assert.equal(result.conclusion, 'No nested delegation.');
});

test('delegation validates task and tool selection', async () => {
  const delegate = buildDelegateTool({ infer: scripted([]), allTools: [readTool] });
  await assert.rejects(delegate.run({}), /needs a task/);
  await assert.rejects(delegate.run({ task: 'Work', tools: ['missing'] }), /no valid tools/);
});
