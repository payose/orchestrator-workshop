# Optional Cloudflare path

This path is optional. The fixture path is the official workshop path and does not need a Cloudflare account.

The Cloudflare path runs the workshop orchestrator with:

- Workers AI for inference
- D1 for incident records and evidence
- the same `runAgent()`, worker orchestration, verification, assessment, and simulated remediation code

Use your own Cloudflare account and disposable workshop resources. Do not use an instructor's account, database, Worker, or credentials.

## What this path does

The current Cloudflare path is a seeded Cloudflare demonstration:

```text
Workers AI inference
→ D1 evidence queries
→ specialist findings
→ evidence verification
→ merged assessment
→ simulated proposal
→ simulated approval
→ simulated rollback
→ simulated recovery
```

It does not yet deploy a separate quote API, generate fresh traffic, or perform a real rollback. The evidence comes from `seed.sql`.

## Requirements

- Node.js 22 or newer
- npm
- A Cloudflare account with Workers AI and D1 access
- Wrangler authentication in the browser

No model API key is required. Workers AI uses the Cloudflare AI binding.

## Setup

From the repository root:

```bash
npm install
npx wrangler login
```

Create a D1 database:

```bash
npx wrangler d1 create fork-delegate-merge-evidence
```

Wrangler prints a database ID. Copy that ID into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "INCIDENT_EVIDENCE",
    "database_name": "fork-delegate-merge-evidence",
    "database_id": "YOUR_DATABASE_ID"
  }
]
```

Apply the schema to the remote D1 database:

```bash
npx wrangler d1 execute fork-delegate-merge-evidence --remote --file=./schema.sql
```

Seed the deployment and quote evidence:

```bash
npx wrangler d1 execute fork-delegate-merge-evidence --remote --file=./seed.sql
```

The seed data contains healthy standard-order responses and broken priority-order responses:

```text
standard orders → HTTP 200
priority orders on broken-02 → HTTP 500
```

Deploy the workshop Worker:

```bash
npm run deploy:cf
```

Save the Worker URL returned by Wrangler.

## Run the Cloudflare demonstration

On macOS or Linux:

```bash
WORKSHOP_URL=https://fork-delegate-merge-workshop.<your-subdomain>.workers.dev \
npm run demo:full:cf
```

In PowerShell:

```powershell
$env:WORKSHOP_URL = "https://fork-delegate-merge-workshop.<your-subdomain>.workers.dev"
npm run demo:full:cf
```

The script sends `POST /demo/full` to the Worker and prints the returned investigation, verdicts, assessment, and remediation states.

You can also check the Worker directly:

```bash
curl https://fork-delegate-merge-workshop.<your-subdomain>.workers.dev/health
```

Expected health response:

```json
{"status":"ok","mode":"cloudflare"}
```

## Why remediation is simulated

The workshop task requires remediation to remain simulated in both fixture and Cloudflare modes. The reasons are practical:

1. The workshop must never deploy to or roll back production infrastructure.
2. Participants must use their own disposable resources, not instructor infrastructure.
3. A real rollback would require a second Worker, deployment permissions, service configuration, recovery traffic, and more secrets.
4. Real deployment timing and Cloudflare configuration could consume the 40-minute workshop.
5. Simulation keeps the authorization lesson repeatable: execution is blocked while proposed and allowed only after approval.

The proposal, approval, execution, and recovery states still represent the real control-flow boundary. Only the external side effect is simulated.

In the current `/demo/full` endpoint, those transitions happen inside one request so the demonstration is deterministic. This means the Cloudflare path does not yet pause for a separate human approval request. An interactive version would persist remediation actions in D1 and expose separate proposal, approve, reject, execute, and verify endpoints.

## If Cloudflare setup fails

Cloudflare is optional. Return to the fixture path immediately:

```bash
npm run smoke
npm run demo:fork
npm run demo:merge
npm run demo:approval
npm run demo:full
```

Do not troubleshoot Cloudflare during the main workshop.
