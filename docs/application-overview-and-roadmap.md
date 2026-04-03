# Provenance — Application Overview & Roadmap

This document describes what the Provenance application is today, how it is built at a high level, and where it is headed. It is organized in chapters so you can jump to the section you need.

---

## Chapter 1 — What Provenance Is

**Provenance** is a web application for **artists**, **collectors**, and **galleries** to manage artwork records, provenance, and professional context in one place. The product aims to be a **single source of truth** for authenticity-relevant data: who owns or shows a work, how it moved through exhibitions and collections, and supporting material (certificates, CVs, grants, leads).

At a glance, the app combines:

- **Identity & accounts** — Sign-in (including OAuth), personal account settings, and role-aware experiences (artist / collector / gallery “perspectives”).
- **Profiles** — Multiple `user_profiles` per account (e.g. artist vs gallery), gallery team membership, and profile claims where relevant.
- **Artworks & exhibitions** — Creating and editing artworks, provenance flows, favorites, and exhibition linkage (including Certificates of Show and related certificate flows).
- **Discovery & programs** — Registry, open calls, grants (including CV upload / AI-assisted flows where configured), articles, and public gallery/artist surfaces.
- **Engagement** — Notifications, follows, and portal-style tools for ongoing work (e.g. opportunities and relationships in the portal).

The codebase name in `package.json` is `provence-app`; the product brand is **Provenance**.

---

## Chapter 2 — Who Uses It (Personas)

| Persona | Typical goals in the app |
|--------|---------------------------|
| **Artist** | Maintain a verified presence, manage artworks and provenance, apply to open calls and grants, track professional data. |
| **Collector** | Document ownership and history, interact with certificates and favorites, discover works and artists. |
| **Gallery** | Represent the gallery as a profile, manage team permissions, post and verify exhibition-related certificates, coordinate open calls and shows. |
| **Admin / operations** | Internal tools (e.g. queued artworks, email tooling, pitch materials) where implemented. |

Permissions for gallery **team members** (owner / admin / member) are documented in [`gallery-team-access.md`](./gallery-team-access.md).

---

## Chapter 3 — Major Feature Areas (Current Product)

The following maps roughly to routes and subsystems in `src/app/`:

- **Home & marketing** — Landing, about, pitch, subscription surfaces.
- **Auth** — Sign-in, sign-up, password reset, MFA verify, OAuth callback handling.
- **Portal** — Logged-in hub; includes areas such as profile settings and specialized views (e.g. opportunities & relationships).
- **Profiles** — List/create/edit profiles, claims, and profile-centric settings.
- **Artworks** — Browse, detail, edit, add batches, provenance editing, “my” artworks, tags, favorites, collectibles.
- **Certificates** — Certificate pages, claim flows, QR-related features (e.g. scan maps / location data where implemented).
- **Exhibitions** — Create and manage exhibitions tied to gallery context.
- **Open calls** — Browse, detail, submissions.
- **Grants** — Grant-related flows (e.g. artist CV upload and processing).
- **Registry & discovery** — Registry listing, artist pages, gallery pages (including slug-based routes).
- **Notifications** — In-app notification list and unread counts.
- **Onboarding** — Guided first-time setup where enabled.
- **Admin** — Administrative pages (content, emails, queued artworks, etc., as built out).

For **how users and data connect** in the codebase (auth → accounts → profiles → artworks → social), see [`USER_DATA_DIAGRAM.md`](./USER_DATA_DIAGRAM.md) and the diagram assets in the same folder.

---

## Chapter 4 — Technical Stack (High Level)

| Layer | Choice |
|-------|--------|
| **Framework** | Next.js (App Router), React |
| **Language** | TypeScript |
| **Backend / DB / Auth** | Supabase (Postgres, RLS, Auth) |
| **UI** | Shared `@kit/*` packages (Makerkit-style), Tailwind-oriented components, Lucide icons |
| **Data fetching (client)** | TanStack React Query |
| **Email** | Resend (see API routes and env configuration) |
| **Analytics** | Vercel Analytics |
| **Deployment** | Vercel (typical; see project deployment docs) |

**Monorepo / packages** — The repo includes Makerkit-derived workspace packages (`@kit/accounts`, `@kit/supabase`, `@kit/ui`, etc.) under `makerkit/`. The main app logic lives under `src/`.

**Schema typing** — Generated Supabase `Database` types (starter kit) may only list a subset of tables (e.g. `accounts`). Application code extends this with a merged **`AppDatabase`** type for app tables such as `user_profiles` and `notifications` (see `src/lib/supabase-app-database.ts`).

---

## Chapter 5 — Security & Data Access Notes

- **Row Level Security (RLS)** on Supabase enforces who can read/write which rows. Application code should still use **server actions** and **permission helpers** for gallery teamwork and artwork edits so behavior stays explicit and consistent.
- Sensitive or environment-specific setup belongs in `.env.local` (never committed). See existing guides in the repo root for DNS, OAuth, email, and migrations.

Related internal docs:

- [`RLS_POLICIES_POSTING_COLLECTOR_ARTIST_GALLERY.md`](./RLS_POLICIES_POSTING_COLLECTOR_ARTIST_GALLERY.md)
- [`gallery-team-access.md`](./gallery-team-access.md)

---

## Chapter 6 — Roadmap & Future Direction

Roadmap items mix **confirmed product direction**, **strategic goals** from investor-facing materials, and **sensible engineering follow-ups**. Priorities will shift with user feedback and runway.

### 6.1 Product & growth

- Deeper **provenance intelligence** — richer history from publications/news, institutional workflows, and tools to surface unknown or unattributed works (evaluated carefully for trust and legal constraints).
- **Grants & opportunities** — expand grant discovery and AI-assisted drafting/research where it helps artists without replacing judgment.
- **Evaluation & insurance adjacency** — systems inspired by established museum/metadata standards (e.g. appraisal and insurance workflows) where partnerships allow.
- **Institutional & donation flows** — workflows for donating works to museums with clear provenance handoff.
- **Relationships & CRM-lite** — strengthen the portal as a place to track galleries, collectors, and opportunities (building on “Opportunities & Relationships” style views).
- **Real-world presence** — conferences, accelerators, and community events (e.g. art weeks, demo days) as distribution and feedback channels.
- **Enterprise / API** — usage-based API access and institutional packages as the data graph matures.

*Strategic financing and round structure are summarized in internal investor docs (e.g. one-pager, confidential memo); this file does not restate terms.*

### 6.2 Platform & engineering

- **Regenerate and maintain Supabase types** from the live schema so `Database` reflects all public tables, reducing the need for manual `AppDatabase` merges over time.
- **Hardening** — expand automated tests around RLS-sensitive flows, certificate edge cases, and upload pipelines (see [`ARTWORK_IMAGE_UPLOAD_FLOW.md`](./ARTWORK_IMAGE_UPLOAD_FLOW.md), [`IPHONE_ARTWORK_UPLOAD_FAILURE_POINTS.md`](./IPHONE_ARTWORK_UPLOAD_FAILURE_POINTS.md)).
- **Observability** — structured logging and error boundaries in critical paths (server actions, payments if added, email senders).
- **Performance** — image optimization, query batching, and caching where profile and artwork lists grow large.
- **Accessibility & mobile** — audit navigation, forms, and certificate views for keyboard and small screens.

### 6.3 Content & compliance

- Clear **terms, privacy, and cookie** surfaces (marketing/legal pages exist; keep them aligned with actual data practices).
- **Export & portability** — artist/gallery-owned data export where users expect it for compliance and trust.

---

## Chapter 7 — Documentation Index

| Document | Topic |
|----------|--------|
| [`USER_DATA_DIAGRAM.md`](./USER_DATA_DIAGRAM.md) | User journey vs data model, mermaid diagrams |
| [`gallery-team-access.md`](./gallery-team-access.md) | Gallery team roles and permission helpers |
| [`RLS_POLICIES_POSTING_COLLECTOR_ARTIST_GALLERY.md`](./RLS_POLICIES_POSTING_COLLECTOR_ARTIST_GALLERY.md) | RLS behavior for posting |
| [`ARTWORK_IMAGE_UPLOAD_FLOW.md`](./ARTWORK_IMAGE_UPLOAD_FLOW.md) | Upload pipeline |
| [`IPHONE_ARTWORK_UPLOAD_FAILURE_POINTS.md`](./IPHONE_ARTWORK_UPLOAD_FAILURE_POINTS.md) | Mobile upload pitfalls |
| [`vc-pitch-provenance.md`](./vc-pitch-provenance.md) | VC / institutional pitch (artists, museums, API) |
| `README.md` (repo root) | Minimal project entry |

---

## Chapter 8 — How to Keep This Document Useful

- **When you ship a major feature** — Add a short bullet under Chapter 3 (or split sub-features if needed).
- **When the roadmap shifts** — Edit Chapter 6; move completed items to a “Recently shipped” subsection or link to release notes if you start using them.
- **When schema or architecture changes materially** — Update Chapter 4 and cross-links in Chapter 7.

---

*Last updated: April 2026. Maintained as a living overview, not a legal or investment document.*
