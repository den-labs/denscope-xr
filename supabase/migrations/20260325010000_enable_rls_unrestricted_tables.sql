-- Enable RLS on tables flagged as UNRESTRICTED by Supabase advisor.
-- Both tables are internal — accessed only via service_role.
-- No anon/authenticated policies needed.

ALTER TABLE public.certificate_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nonces ENABLE ROW LEVEL SECURITY;
