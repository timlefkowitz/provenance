/*
 * -------------------------------------------------------
 * Artwork Shares
 * A private, tokenized link that lets a user hand a single external
 * person a curated, tag-scoped view of their artworks (e.g. "all my
 * Street Photography") without publishing anything or requiring the
 * recipient to have an account.
 *
 * RLS is enabled with NO policies, matching the existing
 * certificate_claim_invites pattern (see 20250325000000): this table
 * holds a sensitive secret (token_hash) and is only ever read/written
 * via the server-side admin client, never directly by anon/authenticated
 * clients.
 * -------------------------------------------------------
 */

create table if not exists public.artwork_shares (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references auth.users(id) on delete cascade,
    tag_id uuid not null references public.tags(id) on delete cascade,
    title text,
    token_hash text not null unique,
    recipient_email text,
    expires_at timestamptz,
    revoked_at timestamptz,
    view_count integer not null default 0,
    last_viewed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists artwork_shares_account_id_idx on public.artwork_shares (account_id);

alter table public.artwork_shares enable row level security;

comment on table public.artwork_shares is 'Tokenized private share links scoping a tag''s artworks to one recipient. No RLS policies: access only via the admin client from server actions/routes (matches certificate_claim_invites).';
comment on column public.artwork_shares.token_hash is 'SHA-256 hex of the raw share token. The raw token is never stored, only ever present in the shareable URL.';
