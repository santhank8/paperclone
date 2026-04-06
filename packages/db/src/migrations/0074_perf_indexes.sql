-- Performance: index heartbeat_runs.status for scheduler/reaper queries.
-- Many hot paths filter by status='queued' or status='running' globally;
-- without this index those scans are full-table on a high-volume table.
CREATE INDEX IF NOT EXISTS heartbeat_runs_status_created_idx
  ON heartbeat_runs (status, created_at);
