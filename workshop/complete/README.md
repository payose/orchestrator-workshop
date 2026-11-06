# Fork, Delegate, Merge — complete checkpoint

A 40-minute DevFest Ilorin workshop for building a small multi-agent incident orchestrator in TypeScript.

The scenario is concrete: priority orders return HTTP 500 while standard orders continue to succeed. Two specialists investigate the incident, their findings are verified against evidence, and a human approves a simulated rollback.

## Requirements

- Node.js 22 or newer
- npm
- Cloudflare credentials are not required for the workshop path

## Fixture mode: the official path

```bash
npm install
npm test
```

The root checkpoint is the attendee version. Its delegation test fails until you complete the TODO in `src/delegate.ts`.

After completing the exercise:

```bash
npm run demo:fork
npm run demo:merge
npm run demo:approval
npm run demo:full
```

`npm run workshop` runs the full incident flow. Fixture inference, seeded evidence, and remediation are deterministic and local.

For a guided progress check that runs the four demonstration stages and asserts their outcomes:

```bash
npm run smoke
```

The smoke test intentionally does not complete the delegation TODO for the attendee.

## Checkpoints

- `workshop/starter` — runnable attendee checkpoint with the delegation TODO.
- `workshop/complete` — completed delegation implementation and passing tests.

Each checkpoint has its own `package.json`, source, tests, and documentation. To verify the finished checkpoint:

```bash
cd workshop/complete
npm install
npm test
npm run demo:full
```

## Optional Cloudflare mode

Cloudflare mode uses the same `runAgent()`, worker slices, orchestration, verification, and simulated remediation. Workers AI supplies inference and D1 supplies evidence and run records. Remediation never deploys or rolls back a real Worker.

1. Create a D1 database and copy its ID into `wrangler.jsonc`.
2. Apply `schema.sql` and `seed.sql` to that database.
3. Run `npm run deploy:cf` after authenticating with Wrangler.
4. Run:

```bash
WORKSHOP_URL=https://<your-worker>.workers.dev npm run demo:full:cf
```

For local development with remote bindings, use `npm run workshop:cf`, then POST to `/demo/full`. If Cloudflare setup fails, return to the fixture commands above. There is no automatic fallback.

The Cloudflare path is optional and must not be configured during the workshop unless it is already working.

## Project map

```text
src/agent.ts          bounded agent loop
src/delegate.ts       attendee exercise
src/orchestrate.ts    concurrent fork, grading, and verification
src/verify.ts         evidence-backed claim checks
src/remediation.ts    approval boundary and simulated rollback
src/fixtures.ts       deterministic local database and inference
src/worker.ts         optional Workers AI + D1 adapter
src/demos/            four terminal demonstrations
tests/                focused runtime and workshop tests
```
