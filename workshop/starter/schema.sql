CREATE TABLE IF NOT EXISTS deployments (
  version_id TEXT PRIMARY KEY,
  release_label TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('healthy', 'broken')),
  deployed_at TEXT NOT NULL,
  traffic_percent INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS quote_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  request_id TEXT,
  order_type TEXT NOT NULL CHECK (order_type IN ('standard', 'priority')),
  quantity INTEGER NOT NULL,
  http_status INTEGER,
  release_label TEXT,
  error_text TEXT,
  transport_error TEXT,
  source TEXT NOT NULL DEFAULT 'workshop-fixture'
);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  objective TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL,
  assessment_json TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  task_key TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  task_id TEXT REFERENCES tasks(task_id),
  role TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL,
  parent_agent_id TEXT,
  steps_used INTEGER,
  conclusion TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  step INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  ok INTEGER NOT NULL,
  output_json TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  task_id TEXT NOT NULL REFERENCES tasks(task_id),
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  worker_key TEXT NOT NULL,
  claim TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
