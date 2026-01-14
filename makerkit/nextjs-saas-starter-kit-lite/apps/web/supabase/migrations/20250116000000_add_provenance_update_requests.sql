-- Table for provenance update requests
create table if not exists public.provenance_update_requests (
    id uuid primary key default gen_random_uuid(),
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    requested_by uuid not null references auth.users(id) on delete cascade,
    requested_at timestamp with time zone default now(),
    status varchar(20) not null default 'pending' check (status in ('pending', 'approved', 'denied')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamp with time zone,
    update_fields jsonb not null default '{}'::jsonb,
    request_message text,
    review_message text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Indexes
create index if not exists provenance_update_requests_artwork_id_idx on public.provenance_update_requests(artwork_id);
create index if not exists provenance_update_requests_requested_by_idx on public.provenance_update_requests(requested_by);
create index if not exists provenance_update_requests_status_idx on public.provenance_update_requests(status);
create index if not exists provenance_update_requests_created_at_idx on public.provenance_update_requests(created_at);

-- RLS Policies
alter table public.provenance_update_requests enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists provenance_update_requests_read_own on public.provenance_update_requests;
drop policy if exists provenance_update_requests_read_artwork_owner on public.provenance_update_requests;
drop policy if exists provenance_update_requests_insert_own on public.provenance_update_requests;
drop policy if exists provenance_update_requests_update_artwork_owner on public.provenance_update_requests;

-- Users can read their own requests
create policy provenance_update_requests_read_own on public.provenance_update_requests
    for select
    to authenticated
    using (requested_by = auth.uid());

-- Artwork owners can read requests for their artworks
create policy provenance_update_requests_read_artwork_owner on public.provenance_update_requests
    for select
    to authenticated
    using (
        exists (
            select 1 from public.artworks
            where artworks.id = provenance_update_requests.artwork_id
            and artworks.account_id = auth.uid()
        )
    );

-- Users can create requests
create policy provenance_update_requests_insert_own on public.provenance_update_requests
    for insert
    to authenticated
    with check (requested_by = auth.uid());

-- Artwork owners can update (approve/deny) requests for their artworks
create policy provenance_update_requests_update_artwork_owner on public.provenance_update_requests
    for update
    to authenticated
    using (
        exists (
            select 1 from public.artworks
            where artworks.id = provenance_update_requests.artwork_id
            and artworks.account_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.artworks
            where artworks.id = provenance_update_requests.artwork_id
            and artworks.account_id = auth.uid()
        )
    );

-- Trigger to update updated_at
create or replace function update_provenance_update_requests_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_provenance_update_requests_updated_at_trigger on public.provenance_update_requests;

create trigger update_provenance_update_requests_updated_at_trigger
    before update on public.provenance_update_requests
    for each row
    execute function update_provenance_update_requests_updated_at();

