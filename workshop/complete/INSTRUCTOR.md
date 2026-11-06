# Instructor run sheet

## Before attendees arrive

```bash
npm install
```

Keep the fixture path open. Do not begin by configuring Cloudflare.

For a quick pre-workshop health check, run:

```bash
npm run smoke
```

This verifies the four demonstration stages without replacing the attendee delegation exercise.

## 1. Frame the problem — 5 minutes

Show `src/agent.ts` and explain the contract: inference proposes an answer or a tool call; the runtime executes the permitted tool and returns an observation.

## 2. Delegation exercise — 10 minutes

Open `src/delegate.ts` and `EXERCISE.md`. Run:

```bash
npm run build
node --test dist/tests/delegate.test.js
```

The starter test should fail. After attendees implement the TODO, the same command should pass. Emphasize fresh history, explicit tool selection, and the absence of `delegate` from the worker tool list.

## 3. Fork — 5 minutes

```bash
npm run demo:fork
```

Point out that telemetry and deployment enter `RUNNING` together. The deployment inference fails deliberately. The telemetry result remains available and the investigation is graded `partial`.

Source to open: `src/orchestrate.ts`, especially `Promise.allSettled`.

## 4. Merge — 5 minutes

```bash
npm run demo:merge
```

The worker labels a real priority request as standard. The verifier reads the seeded evidence and marks that claim `CONTRADICTED`.

Source to open: `src/verify.ts`.

## 5. Human approval — 5 minutes

```bash
npm run demo:approval
```

Show that execution is blocked while the action is `proposed`. The second proposal is approved and then performs only the simulated transition.

Source to open: `src/remediation.ts`.

## 6. Full incident — 10 minutes

```bash
npm run demo:full
```

Trace the flow from detection through recovery. The output is produced by `runIncident()`, `verifyTelemetry()`, `verifyDeployment()`, and `SimulatedRemediation`, not a prerecorded transcript.

## Recovery instructions

- If a test was changed accidentally, use `workshop/complete` as the reference checkpoint.
- If a demo fails after a partial edit, run `npm run build` first; TypeScript errors usually identify the issue.
- If Cloudflare setup fails, stop using it and return to fixture mode. The workshop does not depend on Cloudflare.
- If the full demo is run twice in the same Node process, change its `dedupeKey`; each standalone npm command already starts a fresh process.
