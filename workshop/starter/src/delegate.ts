// ATTENDEE TODO: implement the bounded specialist launch below.
//
// The completed function must:
// - validate the delegated task;
// - keep only explicitly requested tools;
// - launch runAgent() with a fresh history;
// - pass the task, context, tools, inference function, and step budget;
// - return status, stepsUsed, and conclusion;
// - never give the worker this delegate tool.

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
    run: async (_args: unknown) => {
      // Replace this error during the exercise.
      throw new Error('TODO: implement bounded delegation');
    },
  };
}

void runAgent;
void isRecord;
