-- Schedule background polling of the check-reminders edge function.
-- This is what makes journal reminders fire when the user is NOT logged in
-- (or has the tab closed). Without this, reminders only trigger from the
-- in-browser checker, which only runs while the app is open.
--
-- Setup (one-time, in the Supabase SQL editor):
--   1. Store your project URL and service role key in Vault:
--        select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'app_supabase_url');
--        select vault.create_secret('YOUR-SERVICE-ROLE-KEY',           'app_service_role_key');
--   2. Apply this migration. It enables the required extensions and
--      registers a cron job that pings the edge function every minute.
--
-- To inspect the schedule:  select * from cron.job;
-- To unschedule:             select cron.unschedule('check-reminders-job');

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Helper that the cron job invokes. Reads the project URL and service role
-- key from Supabase Vault (configured by the user via vault.create_secret).
create or replace function public.invoke_check_reminders()
returns void
language plpgsql
security definer
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'app_supabase_url' limit 1;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'app_service_role_key' limit 1;

  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'Skipping reminder cron: vault secrets app_supabase_url and/or app_service_role_key are not set. Run: select vault.create_secret(''https://YOUR.supabase.co'', ''app_supabase_url''); select vault.create_secret(''eyJ...'', ''app_service_role_key'');';
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
