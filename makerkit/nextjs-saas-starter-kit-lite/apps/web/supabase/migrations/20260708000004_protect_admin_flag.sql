-- Prevent authenticated users from setting public_data.admin = true on their own account.
-- The admin flag may only be set directly via service-role (e.g. by a super-admin in the DB).

create or replace function kit.protect_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only enforce when an authenticated role (not service_role) modifies the row.
  if current_setting('role', true) = 'authenticated' then
    -- Disallow setting admin = true if it wasn't already true.
    if (new.public_data ->> 'admin')::boolean is true
       and coalesce((old.public_data ->> 'admin')::boolean, false) is false then
      raise exception 'Unauthorized: cannot self-grant admin privileges';
    end if;
  end if;
  return new;
end;
$$;

-- Drop the trigger first if it already exists from a previous attempt.
drop trigger if exists protect_admin_flag_trigger on public.accounts;

create trigger protect_admin_flag_trigger
  before update on public.accounts
  for each row
  execute function kit.protect_admin_flag();
