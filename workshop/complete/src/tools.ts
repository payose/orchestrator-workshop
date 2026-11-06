import type { AgentTool } from './agent.js';

export interface DbStatement {
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface QueryableDb {
  prepare(query: string): { bind(...params: unknown[]): DbStatement };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  return typeof args[key] === 'string' ? args[key] as string : undefined;
}

export function buildTools(db: QueryableDb): AgentTool[] {
  return [
    {
      schema: {
        name: 'queryQuoteEvents',
        description: 'List recorded quote attempts. Filter by order type or HTTP status.',
        parameters: { type: 'object', properties: { orderType: { type: 'string' }, httpStatus: { type: 'number' }, limit: { type: 'number' } } },
      },
      run: async (args: unknown) => {
        if (!isRecord(args)) throw new Error('queryQuoteEvents expects an object');
        const conditions: string[] = [];
        const params: unknown[] = [];
        const orderType = optionalString(args, 'orderType');
        if (orderType) {
          if (orderType !== 'standard' && orderType !== 'priority') throw new Error('orderType must be standard or priority');
          conditions.push('order_type = ?');
          params.push(orderType);
        }
        if (args.httpStatus !== undefined) {
          if (typeof args.httpStatus !== 'number') throw new Error('httpStatus must be a number');
          conditions.push('http_status = ?');
          params.push(args.httpStatus);
        }
        const rawLimit = typeof args.limit === 'number' ? Math.floor(args.limit) : 20;
        const limit = Math.min(Math.max(rawLimit, 1), 100);
        const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
        const { results } = await db.prepare(`SELECT occurred_at, request_id, order_type, quantity, http_status, release_label, error_text FROM quote_events${where} ORDER BY occurred_at DESC LIMIT ${limit}`).bind(...params).all();
        return results;
      },
    },
    {
      schema: {
        name: 'getErrorRate',
        description: 'Count requests and report the HTTP 5xx share.',
        parameters: { type: 'object', properties: {} },
      },
      run: async () => {
        const { results } = await db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN http_status >= 500 THEN 1 ELSE 0 END) AS http5xx, SUM(CASE WHEN http_status IS NULL THEN 1 ELSE 0 END) AS transportUnknown FROM quote_events').bind().all<{ total: number; http5xx: number; transportUnknown: number }>();
        const row = results[0];
        if (!row) throw new Error('getErrorRate returned no rows');
        const completed = row.total - row.transportUnknown;
        return { total: row.total, completed, http5xx: row.http5xx, transportUnknown: row.transportUnknown, errorRate: completed ? row.http5xx / completed : null };
      },
    },
    {
      schema: {
        name: 'listDeployments',
        description: 'List recorded deployments from oldest to newest.',
        parameters: { type: 'object', properties: {} },
      },
      run: async () => {
        const { results } = await db.prepare('SELECT version_id, release_label, variant, deployed_at, traffic_percent FROM deployments ORDER BY deployed_at ASC').bind().all();
        return results;
      },
    },
  ];
}
