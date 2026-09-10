-- OPTIONAL hosted setup, after enabling pg_cron in Supabase Integrations > Cron.
-- Execute as the trusted postgres role in SQL Editor. This is NOT a core migration.
-- Same named job is updated on rerun; no duplicate schedules.
select cron.schedule(
  'the-next-live-expire-pending-orders',
  '* * * * *',
  'select public.expire_pending_orders();'
);

-- Inspect cron.job and cron.job_run_details, or Cron > Jobs > History.
-- To stop later:
-- select cron.unschedule('the-next-live-expire-pending-orders');
