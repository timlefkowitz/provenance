-- Add opportunity type to artist_grants so the agent can distinguish
-- grants, open calls, and residencies in the same table.

alter table artist_grants
  add column if not exists type text not null default 'grant'
    check (type in ('grant', 'open_call', 'residency'));

comment on column artist_grants.type is 'Category of opportunity: grant, open_call, or residency';
