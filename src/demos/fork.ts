import { createFixtureInference, FixtureEvidenceDb } from '../fixtures.js';
import { buildTools } from '../tools.js';
import { MemoryIncidentStore } from '../store.js';
import { runIncident } from '../orchestrate.js';
import { heading, line } from './shared.js';

heading('Demo 1 — Fork');
console.log('[orchestrator] Starting investigation concurrently');
const result = await runIncident({
  store: new MemoryIncidentStore(),
  infer: createFixtureInference({ failDeployment: true }),
  readTools: buildTools(new FixtureEvidenceDb()),
  objective: 'Investigate the order incident.',
  context: 'Priority orders fail while standard orders succeed.',
  dedupeKey: 'demo-fork',
  slices: [
    { key: 'telemetry', task: 'Telemetry specialist: count errors and identify failing requests.', tools: ['getErrorRate', 'queryQuoteEvents'] },
    { key: 'deployment', task: 'Deployment specialist: identify the release associated with the incident.', tools: ['listDeployments'] },
  ],
  onEvent: (event) => {
    if (event.type === 'worker_status') console.log(`[${event.key}] ${event.status}`);
    if (event.type === 'investigation_graded') console.log(`[orchestrator] Investigation ${event.status}`);
  },
});
line('[orchestrator] execution mode', result.executionMode);
line('[orchestrator] preserved worker results', result.workers.map((worker) => ({ key: worker.key, status: worker.status, conclusion: worker.conclusion })));
console.log('[lesson] Promise.allSettled preserves telemetry even when deployment fails.');
