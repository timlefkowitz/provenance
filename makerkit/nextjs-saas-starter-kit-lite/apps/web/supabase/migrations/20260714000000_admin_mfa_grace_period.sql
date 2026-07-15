-- DATA-SAFE: additive only. Adds a grace-period deadline for admins to enroll
-- MFA before their session is hard-blocked (CASA 3.3 — admin interfaces must
-- use MFA). Previously admins with no enrolled factors were let through
-- indefinitely with just a banner nudge (see src/lib/admin.ts). We now start a
-- 7-day clock the moment an account is granted admin, tracked here rather than
-- in public_data so it can't be cleared by an authenticated user the same way
-- the admin flag itself is protected.

alter table public.accounts
  add column if not exists admin_mfa_grace_deadline timestamptz;

comment on column public.accounts.admin_mfa_grace_deadline is
  'Deadline by which an admin must enroll MFA before requireAdmin()/requireAdminApi() hard-block them. Set automatically when public_data.admin transitions to true; cleared when admin is revoked. See kit.set_admin_mfa_grace_deadline().';

create or replace function kit.set_admin_mfa_grace_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Admin newly granted (false/null -> true): start a 7-day MFA enrollment
  -- grace period. Runs regardless of role — this is bookkeeping, not the
  -- privilege-escalation guard (that stays in kit.protect_admin_flag()).
  if (new.public_data ->> 'admin')::boolean is true
     and coalesce((old.public_data ->> 'admin')::boolean, false) is false then
    new.admin_mfa_grace_deadline := now() + interval '7 days';
  end if;

  -- Admin revoked: clear any stale deadline so it doesn't linger if the
  -- account is re-granted admin later without this trigger re-running logic
  -- being relied upon.
  if coalesce((new.public_data ->> 'admin')::boolean, false) is false
     and (old.public_data ->> 'admin')::boolean is true then
    new.admin_mfa_grace_deadline := null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_admin_mfa_grace_deadline_trigger on public.accounts;

create trigger set_admin_mfa_grace_deadline_trigger
  before update on public.accounts
  for each row
  execute function kit.set_admin_mfa_grace_deadline();

-- Backfill: any account that is *already* admin today gets a fresh 7-day
-- grace window starting now, rather than being retroactively hard-blocked
-- (or perpetually grandfathered in with no deadline at all) the moment this
-- migration ships.
update public.accounts
set admin_mfa_grace_deadline = now() + interval '7 days'
where (public_data ->> 'admin')::boolean is true
  and admin_mfa_grace_deadline is null;
