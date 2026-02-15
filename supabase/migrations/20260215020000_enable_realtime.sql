-- Enable Supabase Realtime on scope_events for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE scope_events;
