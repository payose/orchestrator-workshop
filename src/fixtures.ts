import type { ChatMessage, InferResult, ToolSchema } from './agent.js';
import type { QueryableDb } from './tools.js';

export const HEALTHY_VERSION = '11111111-1111-4111-8111-111111111111';
export const BROKEN_VERSION = '22222222-2222-4222-8222-222222222222';
export const REQUEST_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const REQUEST_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const REQUEST_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const REQUEST_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const MISSING_REQUEST = '99999999-9999-4999-8999-999999999999';

interface QuoteEvent {
  occurred_at: string;
  request_id: string;
  order_type: 'standard' | 'priority';
  quantity: number;
  http_status: number;
  release_label: string;
  error_text: string | null;
}

interface Deployment {
  version_id: string;
  release_label: string;
  variant: 'healthy' | 'broken';
  deployed_at: string;
  traffic_percent: number;
}

const events: QuoteEvent[] = [
  { occurred_at: '2026-11-04T10:00:00.000Z', request_id: REQUEST_A, order_type: 'priority', quantity: 2, http_status: 500, release_label: 'broken-02', error_text: 'missing shipping rule' },
  { occurred_at: '2026-11-04T10:01:00.000Z', request_id: REQUEST_B, order_type: 'priority', quantity: 1, http_status: 500, release_label: 'broken-02', error_text: 'missing shipping rule' },
  { occurred_at: '2026-11-04T10:02:00.000Z', request_id: REQUEST_C, order_type: 'standard', quantity: 3, http_status: 200, release_label: 'broken-02', error_text: null },
  { occurred_at: '2026-11-04T10:03:00.000Z', request_id: REQUEST_D, order_type: 'standard', quantity: 1, http_status: 200, release_label: 'broken-02', error_text: null },
  { occurred_at: '2026-11-04T09:00:00.000Z', request_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', order_type: 'standard', quantity: 1, http_status: 200, release_label: 'healthy-01', error_text: null },
  { occurred_at: '2026-11-04T09:01:00.000Z', request_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', order_type: 'standard', quantity: 2, http_status: 200, release_label: 'healthy-01', error_text: null },
];

const deployments: Deployment[] = [
  { version_id: HEALTHY_VERSION, release_label: 'healthy-01', variant: 'healthy', deployed_at: '2026-11-04T08:00:00.000Z', traffic_percent: 100 },
  { version_id: BROKEN_VERSION, release_label: 'broken-02', variant: 'broken', deployed_at: '2026-11-04T09:30:00.000Z', traffic_percent: 100 },
];

/** A tiny D1-shaped evidence adapter for fixture mode. */
export class FixtureEvidenceDb implements QueryableDb {
  readonly requests = events;
  readonly versions = deployments;

  request(requestId: string): QuoteEvent | undefined { return this.requests.find((row) => row.request_id === requestId); }
  deployment(versionId: string): Deployment | undefined { return this.versions.find((row) => row.version_id === versionId); }

  prepare(query: string) {
    return {
      bind: (...params: unknown[]) => ({
        all: async <T = Record<string, unknown>>(): Promise<{ results: T[] }> => {
          if (query.includes('COUNT(*)')) {
            return { results: [{ total: events.length, http5xx: events.filter((row) => row.http_status >= 500).length, transportUnknown: 0 }] as T[] };
          }
          if (query.includes('FROM quote_events WHERE request_id')) {
            return { results: events.filter((row) => row.request_id === params[0]) as T[] };
          }
          if (query.includes('FROM deployments WHERE version_id')) {
            return { results: deployments.filter((row) => row.version_id === params[0]) as T[] };
          }
          if (query.includes('FROM quote_events')) {
            const orderType = params.find((value) => value === 'standard' || value === 'priority') as string | undefined;
            const httpStatus = params.find((value) => typeof value === 'number') as number | undefined;
            let rows = [...events];
            if (orderType) rows = rows.filter((row) => row.order_type === orderType);
            if (httpStatus !== undefined) rows = rows.filter((row) => row.http_status === httpStatus);
            const match = query.match(/LIMIT (\d+)/i);
            const limit = match ? Number(match[1]) : 20;
            return { results: rows.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, limit) as T[] };
          }
          if (query.includes('FROM deployments')) {
            return { results: [...deployments].sort((a, b) => a.deployed_at.localeCompare(b.deployed_at)) as T[] };
          }
          return { results: [] as T[] };
        },
      }),
    };
  }
}

export function createFixtureInference(options: { failDeployment?: boolean } = {}): (messages: ChatMessage[], tools: ToolSchema[]) => Promise<InferResult> {
  return async (messages, tools) => {
    const opening = messages[0]?.content.toLowerCase() ?? '';
    const deployment = opening.includes('deployment');
    const toolNames = tools.map((tool) => tool.name);
    if (options.failDeployment && deployment && messages.length === 1) throw new Error('deterministic deployment specialist failure');

    const calledTools = messages.filter((message) => message.role === 'assistant').map((message) => message.content);
    if (deployment) {
      if (!calledTools.some((message) => message.includes('listDeployments'))) return { kind: 'tool', name: 'listDeployments', args: {} };
      return { kind: 'answer', text: `Deployment finding: ${BROKEN_VERSION} was deployed as broken-02 after ${HEALTHY_VERSION} healthy-01.` };
    }
    if (opening.includes('telemetry')) {
      if (!calledTools.some((message) => message.includes('getErrorRate'))) return { kind: 'tool', name: 'getErrorRate', args: {} };
      if (toolNames.includes('queryQuoteEvents') && !calledTools.some((message) => message.includes('queryQuoteEvents'))) return { kind: 'tool', name: 'queryQuoteEvents', args: { orderType: 'priority', httpStatus: 500 } };
      return { kind: 'answer', text: `Telemetry finding:\n| Total requests | 6 |\n| HTTP 5xx errors | 2 |\nError rate: 33.3%. Failing priority requests: ${REQUEST_A} priority 500 and ${REQUEST_B} priority 500.` };
    }
    return { kind: 'answer', text: 'No specialist task was provided.' };
  };
}
