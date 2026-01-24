/*
 * Create pitch_deck_content table
 * Stores pitch deck slides in the database instead of files
 */

-- Create pitch_deck_content table
create table if not exists public.pitch_deck_content (
    id uuid unique not null default extensions.uuid_generate_v4(),
    key text unique not null default 'main', -- Allows for multiple pitch decks in the future
    content jsonb not null default '{"slides": []}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    primary key (id)
);

comment on table public.pitch_deck_content is 'Stores pitch deck slide content';
comment on column public.pitch_deck_content.key is 'Unique key for the pitch deck (default: main)';
comment on column public.pitch_deck_content.content is 'JSON object containing slides array';

-- Create index for faster lookups
create index if not exists pitch_deck_content_key_idx on public.pitch_deck_content(key);

-- Enable RLS
alter table public.pitch_deck_content enable row level security;

-- RLS Policies
-- Anyone can read pitch deck content (public)
create policy pitch_deck_content_read_public on public.pitch_deck_content
    for select
    using (true);

-- Only admins can insert/update/delete
-- We'll check admin status in the application code, but this provides an extra layer
-- For now, we'll allow authenticated users to write (admin check happens in app)
create policy pitch_deck_content_write_admin on public.pitch_deck_content
    for all
    using (auth.role() = 'authenticated');

-- Insert default content if it doesn't exist
insert into public.pitch_deck_content (key, content)
values ('main', '{"slides": []}'::jsonb)
on conflict (key) do nothing;

