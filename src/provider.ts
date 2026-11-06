import type { InferResult, ToolSchema } from './agent.js';

export function toAiTools(schemas: ToolSchema[]): Array<{ type: 'function'; function: ToolSchema }> {
  return schemas.map((schema) => ({ type: 'function', function: schema }));
}

interface RawToolCall { name?: unknown; arguments?: unknown; function?: { name?: unknown; arguments?: unknown }; }
interface RawReply { response?: unknown; tool_calls?: RawToolCall[]; choices?: Array<{ message?: { content?: unknown; tool_calls?: RawToolCall[] } }>; }

function normalizeArgs(raw: unknown): unknown {
  let value = raw;
  for (let index = 0; index < 3 && typeof value === 'string'; index++) {
    try { value = JSON.parse(value) as unknown; } catch { break; }
  }
  return value;
}

export function parseAiReply(raw: unknown): InferResult {
  const reply = (raw ?? {}) as RawReply;
  const message = reply.choices?.[0]?.message;
  const call = (message?.tool_calls ?? reply.tool_calls ?? [])[0];
  if (call) {
    const name = typeof call.function?.name === 'string' ? call.function.name : call.name;
    if (typeof name === 'string') return { kind: 'tool', name, args: normalizeArgs(call.function?.arguments ?? call.arguments) };
  }
  const content = message?.content ?? reply.response;
  return { kind: 'answer', text: typeof content === 'string' ? content : '(the model returned no text)' };
}
