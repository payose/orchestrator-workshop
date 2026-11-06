import type { ChatMessage, InferResult, ToolSchema } from './agent.js';
import { parseAiReply, toAiTools } from './provider.js';
import { buildTools } from './tools.js';
import { D1IncidentStore, type DbExecutor } from './store.js';
import { runFullWorkflow } from './workflow.js';

export interface CloudflareEnv {
  AI: { run(model: string, input: { messages: Array<{ role: string; content: string }>; tools: unknown }): Promise<unknown> };
  INCIDENT_EVIDENCE: DbExecutor;
  MODEL: string;
  MAX_STEPS?: string;
}

function workersAiInfer(env: CloudflareEnv, messages: ChatMessage[], schemas: ToolSchema[]): Promise<InferResult> {
  return env.AI.run(env.MODEL, { messages: messages.map((message) => ({ role: message.role, content: message.content })), tools: toAiTools(schemas) }).then(parseAiReply);
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') return Response.json({ status: 'ok', mode: 'cloudflare' });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/demo/full') return Response.json({ error: 'Use POST /demo/full' }, { status: 404 });
    try {
      const db = env.INCIDENT_EVIDENCE;
      const infer = (messages: ChatMessage[], tools: ToolSchema[]) => workersAiInfer(env, messages, tools);
      const result = await runFullWorkflow({
        db,
        store: new D1IncidentStore(db),
        infer,
        dedupeKey: `devfest-${Date.now()}`,
        onEvent: (event) => console.log(JSON.stringify(event)),
      });
      return Response.json(result);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error), mode: 'cloudflare' }, { status: 500 });
    }
  },
};
