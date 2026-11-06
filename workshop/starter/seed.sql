INSERT OR REPLACE INTO deployments (version_id, release_label, variant, deployed_at, traffic_percent) VALUES
  ('11111111-1111-4111-8111-111111111111', 'healthy-01', 'healthy', '2026-11-04T08:00:00.000Z', 100),
  ('22222222-2222-4222-8222-222222222222', 'broken-02', 'broken', '2026-11-04T09:30:00.000Z', 100);

INSERT OR REPLACE INTO quote_events (occurred_at, request_id, order_type, quantity, http_status, release_label, error_text, source) VALUES
  ('2026-11-04T10:00:00.000Z', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'priority', 2, 500, 'broken-02', 'missing shipping rule', 'workshop-fixture'),
  ('2026-11-04T10:01:00.000Z', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'priority', 1, 500, 'broken-02', 'missing shipping rule', 'workshop-fixture'),
  ('2026-11-04T10:02:00.000Z', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'standard', 3, 200, 'broken-02', NULL, 'workshop-fixture'),
  ('2026-11-04T10:03:00.000Z', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'standard', 1, 200, 'broken-02', NULL, 'workshop-fixture'),
  ('2026-11-04T09:00:00.000Z', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'standard', 1, 200, 'healthy-01', NULL, 'workshop-fixture'),
  ('2026-11-04T09:01:00.000Z', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'standard', 2, 200, 'healthy-01', NULL, 'workshop-fixture');
