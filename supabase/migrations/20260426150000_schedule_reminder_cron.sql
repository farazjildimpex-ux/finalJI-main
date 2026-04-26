-- Schedule background polling of the check-reminders edge function.
-- This is what makes journal reminders fire when the user is NOT logged in
-- (or has the tab closed). Without this, reminders only trigger from the
-- in-browser checker, which only runs while the app is open.
--
-- Setup (one-time):
--   1. In the Supabase SQL editor, run the two ALTER DATABASE statements
--      below with YOUR project's URL and service role key.
--   2. Apply this migration. It enables the required extensions and
--      registers a cron job that pings the edge function every minute.
--
-- To inspect the schedule:  select * from cron.job;
-- To unschedule:             select cron.unschedule('check-reminders-job');

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Helper that the cron job invokes. Reads the project URL and service role
-- key from database settings (configured by the user via ALTER DATABASE).
create or replace function public.invoke_check_reminders()
returns void
language plpgsql
security definer
as $$
declare
  v_url  text := current_setting('app.supabase_url', true);
  v_key  text := current_setting('app.service_role_key', true);
begin
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'Skipping reminder cron: app.supabase_url and/or app.service_role_key are not set. Run: ALTER DATABASE postgres SET app.supabase_url = ''https://YOUR.supabase.co''; ALTER DATABASE postgres SET app.service_role_key = ''eyJ...'';';
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{"source":"pg_cron"}'::jsonb
  );
end;
$$;

-- Replace any existing schedule with a fresh one running every minute.
do $$
begin
  perform cron.unschedule('check-reminders-job');
exception when others then
  null;
end $$;

select cron.schedule(
  'check-reminders-job',
  '* * * * *',
  $$ select public.invoke_check_reminders(); $$
);
