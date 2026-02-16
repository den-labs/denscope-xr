-- Backfill: set event_timestamp to created_at for all rows where it's NULL
UPDATE scope_events
SET event_timestamp = created_at
WHERE event_timestamp IS NULL;
