/*
 * -------------------------------------------------------
 * Exhibition invoices
 *
 * A gallery picks works from a show, sets the price for each, and sends the
 * buyer a link. The buyer (no account needed) pays every work on the invoice
 * in one Stripe Checkout; payouts split like any show sale (artist share +
 * gallery commission). The link token is the only way in, so these tables
 * are service-role only; all access goes through server actions.
 * -------------------------------------------------------
 */

create table if not exists public.invoices (
  id                  uuid        primary key default gen_random_uuid(),
  token               text        not null unique,
  exhibition_id       uuid        not null references public.exhibitions(id) on delete cascade,
  gallery_account_id  uuid        not null references auth.users(id) on delete cascade,
  created_by          uuid        references auth.users(id) on delete set null,
  buyer_name          text,
  buyer_email         text,
  note                text,
  currency            text        not null default 'usd',
  status              text        not null default 'open'
    check (status in ('open', 'paid', 'cancelled')),
  order_id            uuid        references public.orders(id) on delete set null,
  expires_at          timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_invoices_exhibition on public.invoices (exhibition_id, created_at desc);

create table if not exists public.invoice_items (
  id           uuid        primary key default gen_random_uuid(),
  invoice_id   uuid        not null references public.invoices(id) on delete cascade,
  -- The id the work is shown under in the show (as in order_items).
  artwork_id   uuid        not null references public.artworks(id) on delete cascade,
  title        text,
  price_cents  integer     not null check (price_cents > 0),
  created_at   timestamptz not null default now(),
  unique (invoice_id, artwork_id)
);

create index if not exists idx_invoice_items_invoice on public.invoice_items (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
revoke all on public.invoices from anon, authenticated;
revoke all on public.invoice_items from anon, authenticated;
grant all on public.invoices to service_role;
grant all on public.invoice_items to service_role;

-- Which invoice an order paid, so the webhook can mark it paid.
alter table public.orders
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
