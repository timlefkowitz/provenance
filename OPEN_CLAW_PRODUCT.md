# Provenance / Provence — Product brief for Open Claw

This document summarizes what the **Provenance** platform (the repo also refers to the product as **Provence** in places) is designed to do, who it serves, how objects and certificates are modeled, and how APIs and integrations are intended to work. It is written for an external assistant (for example **Open Claw**) that needs a single source of truth about capabilities **as implemented or scaffolded in this codebase** (Spring 2026).

---

## One-line positioning

A **high-trust registry and journal** for art and objects: users register works and related assets, attach **rich provenance narratives**, issue **role-appropriate certificates**, and (in the product vision) anchor verification to **immutable records** (database today; Avalanche / IPFS described in internal docs).

---

## Core user model (roles)

Onboarding and account metadata support three primary roles (see `user_profiles.role` and onboarding UI):

| Role | Purpose in the product |
|------|-------------------------|
| **Artist** | Primary issuer of **Certificates of Authenticity**; studio practice, CV/grant context, claiming gallery-created stubs. |
| **Collector** | **Certificate of ownership** for pieces in a collection; provenance curation; verification in the certificate workflow. |
| **Gallery** | **Certificate of show** context, **exhibitions**, **open calls**, optional **team members** on a gallery profile, **artist registry stubs** and claim workflow. |

**Institutions** (museums, foundations, universities) are **not a separate `role` enum value** in the schema today. In practice they are expected to map to **gallery**-style organization profiles (public programming, exhibitions, registry) and/or **collector**-style collection custody, depending on how the org uses the platform. Provenance copy explicitly references **institutions** in narrative fields (e.g. former owners, exhibition history).

---

## Surfaces in this monorepo

- **`apps/provenance`** — Journal-styled client: artworks, collectibles, articles, certificate views, provenance editing, onboarding, settings. Home positions **Avalanche C-Chain** in the narrative.
- **`apps/web`** — SaaS shell + **marketing** (blog, FAQ, legal, long-form “create certificate of authenticity” storytelling). Not all database features are exposed as UI here.
- **Smart contract sketch** — `apps/provenance/contracts/ProvenanceRegistry.sol` describes on-chain **record IDs**, **metadata pointers**, **document hashes**, and an **ownership timeline** (implementation status is separate from the app shell).

---

## “Planets” — what you can register

Beyond **fine art** (`artworks`), migrations add parallel registries so the same provenance ideas apply to other asset classes:

| Planet / domain | Table (concept) | Typical fields |
|-----------------|-----------------|------------------|
| **Art** | `artworks` | Title, artist, medium, dimensions, image, status, metadata, `provenance_history` (JSON array), certificate number/hash. |
| **Collectibles** | `collectibles` | Category, grading, serial number, manufacturer/year, public flag, same certificate + provenance patterns. |
| **Vehicles** | `vehicles` | VIN, make/model, title data, mileage, images, provenance timeline. |
| **Real estate** | `properties` | Address, parcel, deed-oriented fields, building metadata, provenance timeline. |

Shared cross-planet concepts (migrations `20260410000003`–`20260410000005`):

- **`asset_events`** — Append-only **event log**: `planet`, `asset_id`, `event_type`, `actor_id`, `payload`, optional `signature`. **Read** is open (transparency); **insert** requires authentication. No update/delete policies (immutability by design).
- **`certificates`** — **Globally unique** `certificate_number`, `planet`, `asset_id`, `version`, `verification_score`, `status`, issuer, metadata. Public read; authenticated insert; issuer can update.
- **`api_keys`** — Per-account keys: `key_hash`, `name`, `scopes`, optional `planet`, rate limit, expiry, activity timestamps. RLS: owners only.

---

## Collection management & how work is tracked

### Per-object record

Each registered object (per planet) is a row with:

- **Ownership / account**: `account_id` ties the asset to the controlling **account** (Makerkit personal account model).
- **Lifecycle**: `status` (e.g. draft vs verified/published patterns on artworks), optional **`is_public`** on vertical tables like collectibles/vehicles/properties.
- **Structured provenance fields** (artworks): former owners, auction history, exhibition history / literature, historic context, celebrity or notable ownership notes — in addition to a flexible **`provenance_history` JSONB** array for timeline-style entries.
- **Media**: `image_url` (and extensible `metadata` JSON).

### Certificates and trust workflow (artworks)

Important columns (see notifications / certificate workflow migration):

- **`certificate_type`**: **`authenticity`** (artist path), **`show`** (gallery), **`ownership`** (collector).
- **`certificate_status`**: e.g. pending artist claim, pending verification, verified, rejected.
- **Artist linkage**: `artist_account_id`, `claimed_by_artist_at`, **`verified_by_owner_at`** (collector/gallery verification step).

This supports a **multi-party narrative**: someone lists a work, the **artist claims** alignment with their practice, the **owner verifies**, and the public sees a **verified** state when policies allow.

### Collaborative correction: provenance update requests

Table **`provenance_update_requests`**: a user can propose structured updates (`update_fields` JSON) with a message; the **artwork owner** approves or denies. Supports accountable community or professional correction without silent edits.

### Gallery operations (schema-heavy)

- **Exhibitions** — Gallery-owned shows linked to artists and artworks (`exhibitions` and related join tables).
- **Open calls** — Gallery-scoped calls for submissions; fields for submission windows, **call_type** (exhibition, art, residency, grant), **eligible_locations**, optional **external_url** for curated listings that point off-platform.
- **Gallery members** — Team access via `gallery_members` and RLS helpers (`is_gallery_member_for_artwork`, `is_gallery_member_for_exhibition`, etc.) so staff can manage the same profile.
- **Artist profile claims** — Galleries may create **unclaimed** artist registry entries; artists **claim** and galleries **approve** (`artist_profile_claims`, nullable `user_id` on `user_profiles` with `created_by_gallery_id`).

### Artist business tools (schema)

- **Artist leads** — Lightweight **CRM kanban**: stages from interested through sold, optional link to an artwork.
- **Artist CV & grants** — CV upload to storage, structured **`artist_cv_json`**, **`artist_grants`** rows (AI-sourced or **curated** grants visible when `user_id` is null), bookmarking and typing migrations as the feature matured.
- **News / publications** — Press links for artists and galleries.

### Notifications

**`notifications`** table supports in-app messaging around workflow events (certificate steps, requests, etc.), aligned with the certificate state machine.

---

## Tools by persona (what Open Claw should assume users can do)

### Artists

- Maintain an **artist profile** (bio, medium, links, optional CV extract for matching).
- Create and manage **artworks** and **certificates of authenticity**; drive **claim** flows when a gallery stub exists.
- Use **grant discovery** (CV-backed, stored recommendations) where the feature is wired in the deployment.
- Track **sales leads** tied to specific works when that UI is enabled.
- Record **press and publications**.

### Collectors

- Operate as **collection owners** on the account model; register objects and set **ownership**-class certificates where applicable.
- Participate in **verification** steps on the certificate workflow.
- Enrich **provenance text** and JSON timelines; optionally request updates via **provenance update requests** when they do not own the row (pattern depends on UI).

### Galleries

- **Gallery profile** with optional **slug** for short public URLs.
- **Exhibitions** and **open calls** (including location-aware and time-bound submission logic).
- **Team management** via gallery members and RLS-aware permissions on artworks and exhibitions.
- **Registry stewardship**: create artist placeholders and run **claim approval**.
- Issue **show**-oriented certificate types where the product allows.

### Institutions (logical fit, not a separate role)

- Use **gallery** and **collector** patterns for **collections**, **loans**, and **exhibitions**; rely on rich **exhibition_history** / **former_owners** fields for museum-grade narrative.
- Consume **public verified** feeds and certificates for due diligence and publication.

---

## API and integrations

### What exists in the database today

- **`api_keys`**: Hashed keys, **scopes**, optional **planet** scoping, rate limits — intended for a **unified verification / write API** (migration comment: “unified verification API”).
- **`asset_events`**: Canonical **append-only audit trail** across planets for integrations and transparency.
- **`certificates`**: Global certificate number namespace with versioning and verification score — suitable for third-party **lookup by certificate number**.

### What to tell Open Claw about HTTP APIs

This repo’s **Next.js `route.ts` handlers** under `app/api` are minimal (auth callback, sitemap, version, etc.). **There is no checked-in REST handler in this tree** that consumes `api_keys` for verification yet; treat the API block as **the contract the data model is built for**, and assume any public HTTP layer would:

- Authenticate via **API key** (hash lookup server-side).
- Respect **scopes** and **planet**.
- Emit **`asset_events`** on mutations and read **`certificates`** for verification responses.

**Supabase** remains the primary **application API** for the web client: PostgREST + RLS for row-level access by role and membership.

---

## Public vs private visibility (conceptual)

- **Verified / published** artworks are readable under **anon** policies where migrations enable public feed behavior.
- Many vertical tables use **`is_public`** plus **owner** policies so collectors can keep objects private while still using the registry internally.
- **Asset events** and **certificates** are designed for **broad read access** to support verification culture.

---

## Blockchain and media (vision vs app)

- **Vision** (from internal README / home copy): hashes of documents, transfer events, CoA signatures, metadata on **IPFS**, settlement on **Avalanche C-Chain**; optional **ERC-721/1155** style assets.
- **App today**: PostgreSQL is the source of truth for listings, workflow, and JSON provenance; **`certificate_hash`** on artworks is reserved for chain anchoring when connected.

---

## Glossary for assistants

| Term | Meaning here |
|------|----------------|
| **Planet** | Asset vertical: art, collectibles, vehicles, real estate — used in shared `certificates` / `asset_events` / `api_keys`. |
| **Certificate** | Both the user-facing document concept and the **`certificates`** row with a unique number. |
| **Provenance history** | JSON array on an object row; editable narrative + structured fields on artworks. |
| **Account** | Makerkit **account** (personal user account id aligns with auth user for personal teams). |
| **Profile** | **`user_profiles`**: role-specific public identity (one row per user per role). |

---

## Honest scope note for Open Claw

When answering end users, distinguish:

1. **Implemented UI** in `apps/provenance` (artworks, collectibles, certificates, provenance edit, onboarding, articles, placeholders such as the registry page).
2. **Rich schema** in `apps/web/supabase/migrations` (galleries, exhibitions, open calls, leads, grants, multi-planet tables, shared API tables).
3. **Marketing narrative** in `apps/web` i18n and pages.

If a feature is **only in SQL**, describe it as “supported by the data model / planned in the platform” unless you confirm a UI route in the same repo.

---

## File pointers (for maintainers and agents)

- Role onboarding: `apps/provenance/src/app/onboarding/`
- Artworks schema: `apps/web/supabase/migrations/20250103000000_create_artworks.sql`
- Provenance fields: `apps/web/supabase/migrations/20250104000000_add_provenance_fields.sql`
- Certificate workflow: `apps/web/supabase/migrations/20250110000000_add_notifications_and_certificate_workflow.sql`
- Certificate types: `apps/web/supabase/migrations/20250213000001_add_certificate_type_to_artworks.sql` and ownership rename migration
- Shared API / events / certificates: `apps/web/supabase/migrations/20260410000003_shared_asset_events.sql`, `20260410000004_shared_certificates.sql`, `20260410000005_shared_api_keys.sql`
- Product vision README: `apps/provenance/README.md`

---

*End of brief — safe to ingest as system context for Open Claw or similar tools.*
