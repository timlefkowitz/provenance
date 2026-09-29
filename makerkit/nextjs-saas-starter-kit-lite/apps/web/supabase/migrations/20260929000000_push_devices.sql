/*
 * -------------------------------------------------------
 * iOS push notifications
 *
 * push_devices: one row per APNs device token, owned by whichever user most
 * recently signed in on that device. The iOS app registers the token after
 * sign-in (registerPushDevice) and removes it on sign-out; account deletion
 * cascades. Service role only — users never read tokens.
 *
 * notifications → push: an AFTER INSERT trigger on public.notifications
 * POSTs the new row's id to the app (/api/push/notification-created), which
 * sends it to APNs. Doing this in the database means every path that creates
 * a notification (server actions, crons, SQL triggers such as
 * notify_gallery_member_added) gets push without touching each call site.
 *
 * The trigger reads its target from Supabase Vault so no secret lives in a
 * migration. Until both secrets exist it does nothing:
 *
 *   select vault.create_secret('https://www.provenance.guru/api/push/notification-created', 'push_webhook_url');
 *   select vault.create_secret('<same value as PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');
 *
 * DATA-SAFE: additive only. New table, function and trigger; no existing row
 * is touched, and the trigger never blocks or fails a notification insert.
 * -------------------------------------------------------
 */

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_devices (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios')),
  -- APNs host the token belongs to. Development builds get sandbox tokens;
  -- the sender flips this after a BadDeviceToken from production.
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  created_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now()
);

create index if not exists push_devices_user_id_idx on public.push_devices(user_id);

comment on table public.push_devices is 'APNs device tokens for the iOS app, one row per device, owned by the signed-in user. Service role only.';

alter table public.push_devices enable row level security;

revoke all on table public.push_devices from anon, authenticated;

create or replace function public.push_notification_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  -- Most users have no iOS device; skip the HTTP call entirely for them.
  if not exists (select 1 from public.push_devices where user_id = new.user_id) then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_webhook_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
  if v_url is null or v_secret is null then
    raise notice '[Push] vault secrets push_webhook_url / push_webhook_secret not set; skipping';
    return new;
  end if;

  -- pg_net is asynchronous: this queues the request and returns immediately.
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notificationId', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 10000
  );

  return new;
exception when others then
  -- Push is best-effort; never lose the in-app notification over it.
  raise warning '[Push] push_notification_created failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notifications_push_after_insert on public.notifications;

create trigger notifications_push_after_insert
  after insert on public.notifications
  for each row
  execute function public.push_notification_created();
