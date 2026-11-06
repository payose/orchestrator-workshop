import {
  runAgent,
  type AgentTool,
  type ChatMessage,
  type InferResult,
  type ToolSchema,
} from './agent.js';
import { isRecord } from './tools.js';

export interface DelegateOptions {
  infer: (messages: ChatMessage[], tools: ToolSchema[]) => Promise<InferResult>;
  allTools: AgentTool[];
  defaultMaxSteps?: number;
}

export function buildDelegateTool(options: DelegateOptions): AgentTool {
  return {
    schema: {
      name: 'delegate',
      description:
        'Hand a bounded task to a specialist with fresh history. Provide its task, context, permitted tool names, and optional step budget. The specialist cannot delegate further.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: "The specialist's objective" },
          context: { type: 'string', description: 'Facts the specialist starts with' },
          tools: { type: 'array', items: { type: 'string' }, description: 'Permitted tool names' },
          maxSteps: { type: 'number', description: 'Specialist step budget' },
        },
        required: ['task'],
      },
    },
    run: async (args: unknown) => {
      if (!isRecord(args) || typeof args.task !== 'string') throw new Error('delegate needs a task string');
      const requested = Array.isArray(args.tools)
        ? args.tools.filter((name): name is string => typeof name === 'string')
        : options.allTools.map((tool) => tool.schema.name);
      const subset = options.allTools.filter((tool) => requested.includes(tool.schema.name));
      if (!subset.length) throw new Error('delegate: no valid tools selected');
      const report = await runAgent({
        objective: args.task,
        context: typeof args.context === 'string' ? args.context : undefined,
        tools: subset,
        maxSteps: typeof args.maxSteps === 'number' ? args.maxSteps : options.defaultMaxSteps ?? 6,
        infer: options.infer,
      });
      return { status: report.status, stepsUsed: report.stepsUsed, conclusion: report.finalAnswer };
    },
  };
}
