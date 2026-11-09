# Roadmap CEO Review — 2026-10-19

Working plan for `/plan-ceo-review` of [`application-overview-and-roadmap.md`](./application-overview-and-roadmap.md) Chapter 6.
Depth: strategy-only. Mode: SCOPE REDUCTION (D2). Commit reviewed: `e65062d`.

## Step 0 findings

- **The roadmap has no target metric and no order.** It dates from April 2026. Since then, 447 commits [measured: `git log --since=2026-04-01`] shipped ~15 surfaces.
  - Shipped roadmap items: grants AI (2026-04-04), CRM (2026-04-20) and Operations (2026-04-22).
  - Shipped work the roadmap never listed: creator sites, the iOS app (live 2026-10-07), StoreKit IAP, passkeys, and exhibitions/open calls.
- **The only goal on record** is ~1,000 paying users, or ~$275K–$385K ARR (`investor-confidential-memo.md:62`). Current user and paid counts are unverified=2, because this session had no read-only path to the live DB.
- **Pricing ceiling.** The highest gallery price today is $99.99/mo or $990/yr (`src/lib/stripe-config.ts:53`). No institution tier or contract pricing exists.
- **Design partner.** P1 is the founder's own 25-year gallery (D15), so it's dogfooding, not an outside buyer.
- **Landscape.**
  - Verisart, SmartStamp ArtID and Artracx sell CoA plus inventory.
  - Galleries compare against ArtLogic, Artwork Archive and Arternal.
  - Provenance tech has historically stalled on two things: incomplete source records, and dealers' need for privacy.

## Strategy (approved)

- **Primary revenue:** major galleries and institutions, both pursued this year (W1 + D16).
- **Artist tool:** stays free or low-tier. It's the secondary career benefit and the supply side.
- **Dogfooding:** the founder's gallery tests every feature first.
- **Billing gate:** invoiced tier billing waits until one outside gallery signs a priced pilot (D19).

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| MODE (Tim) | D2 answer | SCOPE REDUCTION | — | approved | D2: "Scope reduction" |
| W1 (Tim) | stripe-config.ts:53 | Primary revenue = institutions + major galleries; artist tool secondary | — | approved | D2 free-text: "main revenue coming from institutions, major galleries with a plus of helping artist" |
| P1 (Tim) | D6 note, D15 answer | — | Design partner is the founder's own 25-year gallery (dogfooding, not a buyer) | approved (fact) | D6: "real gallery thats been open for 25 years"; D15: "the gallery is my gallery … good that we are dog feeding" |
| R1 provenance intelligence (6.1) | roadmap:95 | on roadmap | Defer | approved: Defer | D3 A |
| R2 grants expansion (6.1) | roadmap:96 | on roadmap | Defer | approved: Defer | D4 A |
| R3 evaluation & insurance (6.1) | roadmap:97 | on roadmap | Defer | approved: Defer | D5 A |
| R4 museum donation flows (6.1) | roadmap:98; reopened by D16 | on roadmap | Defer; trigger = first museum in active conversation | approved: Defer | D6 A; re-confirmed D20 A |
| R5 performance (6.2) | roadmap:110 | on roadmap | Keep | approved: Keep | D7 B |
| R6 a11y & mobile audit (6.2) | roadmap:111; reopened by D16 | on roadmap | Keep: audit + VPAT draft | approved: Keep | D8 A, superseded by D21 A |
| R7 Supabase types regen (6.2) | roadmap:107 | on roadmap | Defer | approved: Defer | D9 A |
| R8 real estate portal | investor-one-pager.md:30 | on investor roadmap | Cut | approved: Cut | D10 A |
| R9 institutional package | create-artworks-batch.ts exists; no spreadsheet ingestion | $990/yr ceiling | Spreadsheet import with dry-run + per-row errors; invoiced institution tier above $990/yr | approved | D11 A |
| R9a document import | exhibitions/_components/checklist-import.tsx, _actions/extract-exhibition-checklist.ts, checklist-parsing.ts | exhibition-only | Generalize the existing checklist importer to inventory: PDF or photo listing N works → N draft artworks through dry-run review | approved (user request) | D11 free-text: "upload a pdf or take a picture of a document … 20 artworks would be created" |
| F1 provenance history | update-provenance.ts:158-176 (cap 200, read-modify-write) | JSON array on row | History table is the only source: trigger diffs provenance columns only; UPDATE/DELETE revoked for every role; JSON writes stop; backfill with dropped entries labelled unrecoverable; concurrent-edit test | approved | D12 A, amended D18 A |
| F2 observability | LOGGING.md; Vercel logs only | no tracker, no alerts | Error tracker + alerts on billing webhooks, certificate invites, provenance edits, imports; runbook per alert | approved | D13 A |
| F3 CI tests | .github/workflows/security.yml (OSV + eslint only) | tests never run in CI | vitest + typecheck on every push; tests for canManageGallery, certificate issue/verify, provenance edits | approved | D14 A |
| O1 contract with partner | D15 | — | Priced contract with P1 | declined | D15: own gallery, contract doesn't apply |
| O1b first outside buyer | D19 | — | Tier billing waits for one outside gallery on a priced pilot; other core work proceeds | approved | D19 A |
| O2 market sequence | D16 | — | Galleries and museums both this year | approved: Both | D16 B |
| O3 AI-import privacy | extract-exhibition-checklist.ts sends docs to OpenAI | no disclosure | Sub-processor list + template DPA; per-gallery switch turning AI import off; SSO, security questionnaire, uptime terms → TODOS | approved | D17 A |

Approval readiness: PASS — checked MODE, W1, P1, R1–R9a, F1–F3, O1, O1b, O2, O3 against D2–D21 answers above.

## Minimum core, in build order

1. **Dogfood import on your own gallery** (R9a, R9).
   - **Scope:** lift the exhibition checklist importer into a standalone inventory import. Add spreadsheet ingestion that reads ArtLogic, Artwork Archive and Arternal exports. Run it on the gallery's real archive first.
   - **Owner must prove a quiet path:** no certification emails, notifications, Stripe listings or streaks fire during import. Today `create-artworks-batch.ts` triggers all four.
   - **Owner must prove scans work:** scanned PDFs are rejected today with "looks like a scan", so route them to the photo/vision path.
   - **Owner must prove long documents work:** text over 30,000 chars is silently truncated today.
   - **Owner must prove the schema is enough:** extend extraction beyond artist, title, price and dimensions to include medium, date, edition and owner.
   - **Owner must prove the AI-off switch is respected** (O3).
2. **Append-only provenance history** (F1, D18). Build it before the import loads 25 years of records into the history.
3. **Error tracker, alerts and CI tests** (F2, F3).
4. **Accessibility audit and VPAT draft** (R6, D21). Cover the certificate, collection and import screens.
5. **Privacy disclosures** (O3): a sub-processor list, a template DPA and the AI-import opt-out.
6. **Performance** (R5). First measure the gallery's inventory: number of works, number of images and team size. Then optimize the slowest page.
7. **Outside pilot, then tier billing** (O1b, R9). Sign one outside gallery to a priced pilot, then build invoiced billing. The owner must prove that iOS users in an invoiced-tier org get their entitlements, and that the app never steers anyone to an off-app purchase.
8. **Gallery ops and CRM** (retained 6.1). Harden them; don't add to them.
9. **Real-world presence** (retained 6.1). Walk fairs and art weeks with a demo and a pipeline target (meetings booked, pilots signed) instead of paying for booths. The owner must set a budget.
10. **Export, portability and legal pages** (retained 6.3). Export stays behind `canManageGallery`.

## NOT in scope

- **Cut:** R8 real estate portal (D10). It's outside art provenance. Also remove it from the investor one-pager.
- **Deferred to TODOS.md:**
  - R1 (D3), R2 (D4), R3 (D5) and R7 (D9).
  - R4 (D20). Its trigger is the first museum in active conversation.
  - Heavier procurement items: SSO, a security questionnaire and uptime terms (D17).
- **Declined:** O1, a contract with the partner gallery, because it's the founder's own gallery (D15).

## What already exists

- **Document → draft artworks:** R9a reuses all four of these.
  - `exhibitions/_components/checklist-import.tsx`
  - `_actions/extract-exhibition-checklist.ts` (AI consent, rate limit of 10 per 10 min, pdf-parse)
  - `_helpers/checklist-parsing.ts` (max 200 works)
  - `_actions/create-exhibition-listings.ts` (creates drafts)
- **Batch create:** `artworks/add/_actions/create-artworks-batch.ts`. Reuse it only behind a quiet path.
- **Gallery teams:** `gallery_members` with owner, admin and member roles, plus `canManageGallery` (`docs/gallery-team-access.md`).
- **Operations:** shipping, insurance, acquisitions, vendors, condition reports and invoice PDFs.
- **Sales tooling:** CRM with deal-intel fields, the `/lp/institution` landing page and admin API keys.
- **Logging and tests:** a structured logger and a client error route (`LOGGING.md`), plus 20 vitest unit tests that CI doesn't run yet.

## Dream state delta

```
CURRENT                          AFTER THIS PLAN                       12-MONTH IDEAL
15 surfaces, no metric,   --->   own gallery fully imported with  ---> major galleries + museums paying
$990/yr ceiling, history         a tamper-resistant history;           invoiced contracts; import from
lossy, no CI tests               alerts + CI; VPAT; 1 outside           any legacy system; first museum
                                 priced pilot → tier billing            using donation flow (R4 trigger)
```
This plan moves toward the 12-month ideal. It deliberately holds museum-specific workflows and the API until a museum is in conversation.

## Error & Rescue Registry (capability level)

```
CAPABILITY             | WHAT FAILS                               | RESCUED? | USER SEES                 | OWNER MUST PROVE
-----------------------|------------------------------------------|----------|---------------------------|-------------------------------
Document import (R9a)  | scanned PDF                              | partial  | "take a photo" message    | vision path for scans
                       | >30K chars                               | N ← GAP  | silently truncated list   | chunking or explicit warning
                       | AI returns wrong/invalid rows            | Y        | dry-run review            | per-row errors, nothing auto-created
                       | AI consent missing / rate limited        | Y        | message                   | batch-friendly limits for import
Spreadsheet import     | bad columns, duplicates, missing images  | n/a      | not built                 | dry-run + per-row errors + dedupe
Import side effects    | emails/notifications/Stripe per row      | N ← GAP  | hundreds of emails        | quiet path
Provenance history (F1)| concurrent edit / >200 entries           | N ← GAP  | silent loss (today)       | append-only table, D18
Billing webhooks       | Stripe/Apple webhook fails               | partial  | logged only               | alert (F2)
Certificate invites    | email undelivered                        | Y        | surfaced (aefa787)        | alert (F2)
Export (6.3)           | partial export                           | n/a      | not built                 | full, restorable, permission-scoped
```

## Failure Modes Registry

```
CODEPATH            | FAILURE MODE                    | RESCUED? | TEST?   | USER SEES?         | LOGGED?
--------------------|---------------------------------|----------|---------|--------------------|--------
provenance history  | entries dropped / overwritten   | N        | N       | Silent             | N      ← CRITICAL GAP (fixed by F1)
document import     | long PDF truncated              | N        | unknown | Silent             | N      ← CRITICAL GAP (owner: R9a)
bulk import         | side-effect spam                | N        | N       | emails to contacts | partial ← GAP (owner: R9 quiet path)
billing webhooks    | failure unnoticed               | partial  | partial | delayed            | Y      ← fixed by F2
gallery permissions | regression ships                | N        | N       | wrong access       | N      ← fixed by F3
```
The registry has 3 CRITICAL GAPS. Each has an approved owner: F1, R9a and the R9 quiet path.

## Diagrams

System architecture (target):
```
                 ┌──── Major galleries + museums (P1: founder's gallery dogfoods) ────┐
 Spreadsheet / PDF / photo ─> [Import: extract → dry-run review → quiet create] ─> artworks
                                         │ (AI-off switch, O3)                        │
                                         ▼                                            ▼
                              provenance_history TABLE (append-only, trigger) ─> certificates / QR
 gallery_members ─ Operations ─ CRM ─ Export(canManageGallery)        alerts (F2) ◄── all of the above
 Billing: Stripe/IAP $990 ──(after outside pilot, O1b)──> invoiced institution tier
```
Import data flow with shadow paths:
```
UPLOAD ─> VALIDATE(type/size, consent, AI-off?) ─> EXTRACT(AI or CSV parse) ─> REVIEW(dry run) ─> CREATE(quiet) ─> HISTORY(trigger)
  │nil/empty → reject   │scan → photo path        │>30K → warn/chunk         │dup → flag      │fail → per-row error, no partial silent
```

## Stale Diagram Audit

`application-overview-and-roadmap.md` has no ASCII diagrams. Its Chapter 3 text is stale: it doesn't mention iOS, sites, exhibitions/open calls, operations or CRM. Update it when this plan is adopted.

## REALITY rows

- REALITY: premise-table finding unverified=2 (user count, paid count) docs/investor-one-pager.md:7
- REALITY: already-done finding (CRM, Operations, grants AI shipped Apr 2026; document→draft import exists) src/app/exhibitions/_actions/extract-exhibition-checklist.ts:96
- REALITY: surface-check pass every named file/route verified on disk (checklist-import.tsx, extract-exhibition-checklist.ts, create-artworks-batch.ts, update-provenance.ts, /lp/institution, admin/api-keys) src/app/artworks/add/_actions/create-artworks-batch.ts:21
- REALITY: binding-decisions pass no recorded decisions (gstack-decision-search empty) docs/application-overview-and-roadmap.md:89
- REALITY: numbers finding no measured baseline for users/revenue; prices measured src/lib/stripe-config.ts:53
- REALITY: deferred-asks pass no linked issue docs/application-overview-and-roadmap.md:89
- REALITY: pr-count pass no .gstack/ship-policy.json, default one PR per wave; T1–T6 are separate waves docs/roadmap-ceo-review-2026-10-19.md:140

## Implementation Tasks

These are strategy-level tasks. Each one names the next action and its owner; none of them fixes implementation contracts.

- [ ] **T1 (P1, human: ~3d / CC: ~4h)** — import — Generalize the exhibition checklist importer into an inventory import with a quiet create path
  - Surfaced by: Outside voice #3, #8; R9a
  - Files: src/app/exhibitions/_actions/extract-exhibition-checklist.ts, src/app/exhibitions/_helpers/checklist-parsing.ts, src/app/artworks/add/_actions/create-artworks-batch.ts, others to be determined
  - Verify: import the founder's gallery archive; zero emails/notifications/Stripe listings sent; scanned PDF and >30K-char doc handled
- [ ] **T2 (P1, human: ~2d / CC: ~2h)** — provenance — Append-only history table per D18, then backfill
  - Surfaced by: Section 1 F1; Outside voice #7
  - Files: src/app/artworks/[id]/edit/_actions/update-provenance.ts, new migration (to be determined)
  - Verify: concurrent-edit test keeps both entries; UPDATE/DELETE on the history table fails for every role
- [ ] **T3 (P1, human: ~1d / CC: ~1h)** — CI — Run vitest + typecheck on push; add trust-path tests
  - Surfaced by: Section 6 F3
  - Files: .github/workflows/ (new workflow), tests to be determined
  - Verify: CI fails on a deliberately broken canManageGallery test
- [ ] **T4 (P1, human: ~1d / CC: ~1h)** — observability — Error tracker + alerts + runbooks
  - Surfaced by: Section 8 F2
  - Files: to be determined
  - Verify: a forced webhook failure pages within 5 minutes
- [ ] **T5 (P2, human: ~1d / CC: ~1h)** — privacy — Sub-processor list, template DPA, per-gallery AI-import switch
  - Surfaced by: Outside voice #5; O3
  - Files: src/app/privacy-policy/, others to be determined
  - Verify: with the switch off, AI extraction is refused and spreadsheet import still works
- [ ] **T6 (P2, human: ~2d / CC: ~3h)** — a11y — Audit certificate, collection, import screens; draft VPAT
  - Surfaced by: D21
  - Files: to be determined
  - Verify: keyboard-only pass through the import and certificate flows
- [ ] **T7 (P2, human: ~2h / CC: ~15min)** — performance — Measure the gallery's inventory (works, images, team) before optimizing
  - Surfaced by: Outside voice #12; R5
  - Files: none
  - Verify: numbers recorded in this doc
- [ ] **T8 (P1, human: ongoing / CC: n/a)** — sales — Sign one outside gallery to a priced pilot before building tier billing
  - Surfaced by: Outside voice #1; O1b
  - Files: none
  - Verify: signed pilot with a price above $990/yr

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SCOPE REDUCTION                             |
  | System Audit         | stale roadmap; $990 ceiling; no CI tests    |
  | Step 0               | REDUCTION; W1 galleries+institutions; 8 cuts|
  | Section 1  (Arch)    | 2 issues found (R9 import, F1 history)      |
  | Section 2  (Errors)  | 10 error paths mapped, 3 GAPS               |
  | Section 3  (Security)| 3 issues found, 1 High severity             |
  | Section 4  (Data/UX) | 5 edge cases mapped, 3 unhandled            |
  | Section 5  (Quality) | 0 issues beyond F1                          |
  | Section 6  (Tests)   | Diagram produced, 1 gap (F3)                |
  | Section 7  (Perf)    | 1 issue found (no baseline)                 |
  | Section 8  (Observ)  | 1 gap found (F2)                            |
  | Section 9  (Deploy)  | 1 risk flagged (live-DB migrations)         |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 2           |
  | Section 11 (Design)  | 1 issue (import states)                     |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (8 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 10 rows, 3 CRITICAL GAPS                    |
  | Failure modes        | 5 total, 3 CRITICAL GAPS (all owned)        |
  | TODOS.md updates     | 6 items                                     |
  | Scope proposals      | 0 proposed, 0 accepted (REDUCTION)          |
  | CEO plan             | skipped by mode                             |
  | Outside voice        | codex not installed; native fallback, 12 findings |
  | Lake Score           | N/A (no coverage-scored questions)          |
  | Diagrams produced    | 3 (architecture, data flow, error registry) |
  | Stale diagrams found | 0 (Chapter 3 text stale)                    |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows (PLAN_REALITY pass), 2 unverified  |
  +====================================================================+
```

## Eng Review: T1 + T2 (2026-10-19)

Target: T1 (dogfood import) and T2 (append-only history) from this document's Implementation Tasks. Commit `e65062d`.

### Scope record

feature answers: none proposed (no cuts); structure: Smaller arrangement, D1 (eng); accepted scope: T2 writes `record_edited` events into the existing `provenance_events` table via a DB trigger, revokes UPDATE/DELETE on it for every role, stops writing `artworks.provenance_history`, and the certificate reads events. T1 extracts the extraction + quiet-create code from the exhibition files into one shared importer used by exhibitions and a new inventory import page. Approved guarantees D11 (dry-run, per-row errors, institution tier) and D12/D18 (single source, provenance-column diff, revoked UPDATE/DELETE, backfill with unrecoverable entries labelled) are unchanged. pending remedies: E1 spreadsheet format, E2 test database for trigger tests, E3 import-creation events, E4 batch size/timeouts.

Scope Challenge result: scope accepted as-is (smaller arrangement preserves scope).

### Scope Challenge findings

1. [P1] (confidence: 9/10) `20260428000000_provenance_events_and_invite_batches.sql:94` — `create table if not exists public.provenance_events` already exists, with RLS select-only for `authenticated` (`:112-127`) and is described as "the immutable audit log" (`20260506000000_sales_attribution.sql:56`). Service role can still UPDATE/DELETE (no revoke). Disposition: reuse, D1.
2. [P1] (confidence: 9/10) `src/app/exhibitions/_actions/create-exhibition-listings.ts:151-173` — the quiet create path already exists: draft inserts with no notification, email, Stripe or streak calls. Correction to the CEO review, which assumed `create-artworks-batch.ts` would be the base. Disposition: factual correction, no behavior change.
3. [P1] (confidence: 9/10) `create-exhibition-listings.ts:129-134` returns an error after earlier rows were already inserted; `:177-180` and `:190-193` `continue` silently. A retry duplicates rows. Disposition: covered by approved R9 per-row errors + dedupe (D11 A); implementation must prove it.
4. [P2] (confidence: 8/10) `create-exhibition-listings.ts:119` runs upload + `ensureArtistProfileForCertificate` + insert + link serially per row in one server action, with no `maxDuration` on the route. Disposition: pending, E4 (Section 4).
5. [P2] (confidence: 9/10) `package.json` has `pdf-parse` and `openai` but no spreadsheet parser. Disposition: pending, E1.
6. [P2] (confidence: 8/10) Memory `supabase-migration-push`: local dev `.env.local` points at the live DB, so trigger and concurrency tests cannot run locally as-is. Disposition: pending, E2 (Section 3).
7. [P3] (confidence: 9/10) `20260410000000_island_collectibles.sql:19` (and vehicles, properties) define `provenance_history` columns that no code writes. Out of T2 scope; noted only.

### Section 1: Architecture

```
 edit form ──updateProvenance (user client)──┐
 propagate-provenance (admin client) ────────┼─> UPDATE artworks ──trigger(diff provenance cols)──> provenance_events
 inventory/exhibition importer (quiet) ──────┘   INSERT artworks ──(E3?)──────────────────────────> provenance_events
 delete-artwork.ts:42 / admin-delete-artwork.ts:48 ── DELETE artworks ──FK on delete cascade──X──> provenance_events (wiped)
 certificate page ── reads provenance_events (record_edited) instead of artworks.provenance_history
```

8. [P1] (confidence: 9/10) `20260428000000_provenance_events_and_invite_batches.sql:96` `artwork_id uuid not null references public.artworks(id) on delete cascade` + `src/app/artworks/[id]/_actions/delete-artwork.ts:42` `.delete()` — deleting an artwork deletes its audit trail; revoked grants don't stop FK cascades. Violates D18 "nothing dropped". Disposition: pending, E5.
9. [P1] (confidence: 9/10) `src/lib/certificate-claims/propagate-provenance.ts:109-163` inserts a `coo_issued`/`cos_issued`/`coa_issued` event, then mirrors text into `former_owners`/`exhibition_history`/`historic_context` with the admin client. Under the trigger that update also logs `record_edited`, with `auth.uid()` null (no actor) and duplicating the structured event. Disposition: pending, E6.
10. [P2] (confidence: 8/10) D18 says "revoke UPDATE/DELETE for every role". In Postgres the table owner (`postgres`, used by migrations) keeps those rights. Correction: revoke from `anon`, `authenticated`, `service_role`; document that owner/migration access remains. Disposition: factual correction of D18's wording; no behavior change for app roles.
11. [P2] (confidence: 8/10) `certificate-of-authenticity.tsx:120-135` reads `previousValues` keyed by camelCase action input names; a trigger sees snake_case columns. The backfill and new events need one metadata shape, `{changed: {column: {from, to}}}`, and the certificate maps it. Disposition: implementation proof of D18; no question.

### Decision ledger (eng)

#### E1: Spreadsheet format
Plan baseline: R9 "spreadsheet import" (D11 A), format unspecified.
Runtime evidence: no spreadsheet parser in package.json.
State: approved
Actual answer: D2 (eng) A, "CSV via papaparse"
Accepted scope: .csv only via papaparse; column-mapping step; upload page explains CSV export from Excel, Sheets, ArtLogic, Artwork Archive.

#### E5: Audit trail survives artwork deletion
Plan baseline: D18 "nothing dropped"; FK cascade unaddressed.
Runtime evidence: finding 8.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| FK on provenance_events.artwork_id | on delete cascade | dropped (plain uuid, NOT NULL kept) | on delete restrict |
| Artwork deletion | allowed, wipes history | allowed, history kept (orphaned, admin-visible) | blocked once any event exists |
| Event snapshot | none | title + artist copied into metadata at write | none |
Question D3: see AskUserQuestion D3 (eng).
State: approved
Actual answer: D9 (eng) A, "Keep history, allow delete" (reopened by OV1: RESTRICT breaks Apple-required account deletion via delete-account.ts:75 cascade)
Accepted scope: drop the FK on provenance_events.artwork_id (plain uuid, NOT NULL kept); every event stores an artwork title + artist snapshot in metadata; orphaned history visible in an admin view; artwork and account deletion work as today.
History: D3 (eng) B "Block delete once history exists" (RESTRICT), superseded by D9.

#### E6: Edits made by system code (admin client)
Plan baseline: D18 trigger diffs provenance columns; actor and system writes unaddressed.
Runtime evidence: finding 9.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| System mirror writes | not logged | logged, tagged metadata.source='system', actor null | skipped via RPC that sets a session flag |
| Code change outside trigger | none | certificate filters/labels system rows | propagate-provenance switches to an RPC |
| Bypass risk | n/a | none: every change logged | any admin write that forgets the RPC is logged as user-less edit anyway |
Question D4: see AskUserQuestion D4 (eng).
State: approved
Actual answer: D11 (eng) A, "Log all + pass actor" (reopened by OV11)
Accepted scope: trigger logs every provenance-column change; actor = auth.uid(), else the actor set for the transaction by a small `set_provenance_actor(uuid)` DB function that admin-key paths acting for a person call (propagate-provenance, admin delete, admin reports); else metadata.source='system'. Certificate labels system rows.
History: D4 (eng) A "Log all, label system".

#### E3: Imported artworks start their audit trail
Plan baseline: none (new).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| INSERT trigger | none | logs record_created with metadata.source + import batch id/file name | none |
| Importer change | none | writes import_batch_id + file name into artworks.metadata | none |
Question D5: see AskUserQuestion D5 (eng).
State: approved
Actual answer: D5 (eng) A, "Log imports"
Accepted scope: importer writes import_batch_id + file name into artworks.metadata; INSERT trigger logs record_created with source and batch id.

#### E7: Cleaning up imports when deletes are blocked (conflict E5 x E3)
Finding: E5 B (restrict) + E3 A (insert event on every import) means every imported artwork has an event at creation, so no path (user, admin client or service role) can delete it; D3 option B's "admin help" does not exist.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| E5 FK | restrict (D3 B) | restrict (unchanged) | reopen E5: keep history, allow delete (D3 A) |
| Removing a bad import | impossible | archive: status 'archived', hidden everywhere; "Undo import" archives a whole batch by id, logged as an event | real delete; events kept and orphaned |
| Draft deletion generally | blocked once any event | becomes archive for any artwork with events | delete as today |
Question D6: see AskUserQuestion D6 (eng).
State: superseded
Actual answer: D6 (eng) A, "Archive instead"; superseded by D9 (eng) A, which removes the conflict. Archive status and the owner-query sweep are dropped. "Undo import" becomes delete-by-batch (server-issued batch id), logged as an event.
Accepted scope: none (superseded)
History: D6 (eng) A accepted scope was: artworks with any event get Archive instead of Delete (status 'archived'); hidden from feed, collection, registry, search; "Undo import" archives a batch by import_batch_id and logs an event; D3 and D5 unchanged. Owner-facing artwork queries must exclude 'archived'.

### Section 2: Code quality

12. [P2] (confidence: 9/10) Shared importer per D1: callers are `createQuickExhibitionListings` (`create-exhibition-listings.ts:32`) and the proposed inventory import action (proposed caller, motivated by R9a). Move extraction (`extract-exhibition-checklist.ts:46-140`), the row normaliser (`checklist-parsing.ts:49-79`) and the per-row quiet create (`create-exhibition-listings.ts:119-197`) into `src/lib/import/`; the exhibition action keeps only its exhibition link step. Estimate: ~200 lines moved, ~150 new (CSV mapping, batch metadata, per-row results) [estimated]. Disposition: approved structure, D1.
13. [P2] (confidence: 8/10) 97 files query `from('artworks')`; 39 reference `status` [measured: grep]. Public reads use `.eq('status', 'verified')` (44 call sites) so archived works stay hidden publicly; owner views do not filter status. Disposition: implementation proof of E7 (D6 A): add a shared `excludeArchived` filter and use it in owner lists.
14. [P2] (confidence: 9/10) `extract-exhibition-checklist.ts:59,90` use `console.*`, against `LOGGING.md` ("use the structured logger"). Move to `logger` with `importBatchId` while extracting. Disposition: implementation proof of F2 (D13 A, alerts on imports).
15. [P2] (confidence: 9/10) `checklist-parsing.ts:6-11` row type has only artistName/title/price/dimensions. Extend with medium, year, edition, owner per CEO core item 1. Disposition: approved scope (D11).
16. [P3] (confidence: 8/10) Per-gallery AI-off switch (O3, D17) belongs to T5, not T1. T1 must call one `canUseAiImport()` check so T5 only fills it in. Disposition: dependency note.

### Section 3: Tests

```
TEST MAP                                   TYPE          EXISTS?   NEEDS
CSV parse + column mapping (quotes, BOM,   unit          no        new: src/lib/import/csv.test.ts
  blank rows, unknown headers)
normalizeChecklist with new fields         unit          yes       extend exhibitions/_helpers/checklist-parsing.test.ts (moves with the helper)
importer per-row results, dedupe, partial  unit (mock    no        new: src/lib/import/create-rows.test.ts
  failure, quiet (no notify/email/Stripe))   supabase)
exhibition import still links rows         unit          no        regression test (D1 touches exhibition code)
trigger: edit -> record_edited, diff only  DB            no        E2
  provenance cols, actor, source=system
trigger: insert w/ batch -> record_created DB            no        E2
UPDATE/DELETE on provenance_events denied  DB            no        E2
artwork delete blocked when events exist   DB            no        E2
two concurrent edits -> two events         DB            no        E2
backfill: JSON entries -> events, count    DB            no        E2
archive hides from owner lists             unit          no        excludeArchived helper test
certificate renders events + system label  unit          no        mapping helper test
```
17. [P1] (confidence: 9/10) Every T2 guarantee lives in SQL (trigger, grants, FK restrict, backfill), and local dev points at the live DB (memory `supabase-migration-push`). No DB test can run safely today. Disposition: pending, E2.

### Section 4: Performance

18. [P2] (confidence: 8/10) `create-exhibition-listings.ts:119-197` does image upload + `ensureArtistProfileForCertificate` + insert + link one row at a time inside one server action; no `maxDuration` export on the calling route (only `exhibitions/submit/page.tsx:5` sets 60). A 200-row document [MAX_CHECKLIST_ARTWORKS = 200, `checklist-parsing.ts:20`] risks a timeout mid-batch, leaving a partial import. Disposition: pending, E4.
19. [P3] (confidence: 7/10) Trigger cost: one row per changed artwork update; indexed on `(artwork_id, event_date desc)` (`provenance_events` migration line 107). Negligible at current scale. Backfill size unmeasured: count `artworks` with non-empty `provenance_history` before running [re-measure before gate].

#### E2: Where T2's database tests run
Finding 17.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| Test database | none (dev = live) | local Supabase via `supabase start` (Docker), migrations applied, SQL tests in CI | Supabase branch database per PR |
| Cost | n/a | free; Docker in CI | paid branching add-on |
| Guarantees proven | none | all 6 DB rows in the test map | all 6 DB rows |
Question D7: see AskUserQuestion D7 (eng).
State: approved
Actual answer: D7 (eng) A, "Local Supabase in CI"
Accepted scope: GitHub Actions job runs `supabase start`, applies all migrations, runs SQL tests for trigger, locked table, blocked delete, concurrency and backfill; same setup usable locally. Tests never touch the live DB.

#### E4: Large imports and timeouts
Finding 18.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| Rows per server call | all (up to 200) | chunks of 25, client loops with progress bar | all, background job + polling |
| Timeout | default | maxDuration 60 on import route | job runner |
| Partial failure | silent | per-chunk results; resume from last chunk (idempotent by batch id + row index) | job retries |
Question D8: see AskUserQuestion D8 (eng).
State: approved
Actual answer: D8 (eng) A, "Chunks of 25 + resume"
Accepted scope: browser sends 25 rows per server call with progress; each row carries import_batch_id + row index so retries skip created rows; import route sets maxDuration 60; per-row results per chunk.

### Outside voice (native Plan-agent fallback; codex not installed)

13 findings, key claims re-verified by reading the cited code. Dispositions:

- OV1 [Critical] (confidence: 9/10) `src/app/settings/_actions/delete-account.ts:75` `auth.admin.deleteUser` cascades `accounts` -> `artworks` (`20250103000000_create_artworks.sql:17` `on delete cascade`); with E5 RESTRICT, Apple-required account deletion fails for any user with events. Disposition: reopens E5, D9.
- OV2 [High] (confidence: 9/10) `provenance_events` SELECT is owner-only (`20260428...sql:116-126`); certificate page serves `status.eq.verified` to anyone (`certificate/page.tsx:134`). Buyers and QR scanners would see no history; a naive public read leaks `value`/`owned_by`/`sold_by` marked private. Disposition: new choice E8, D10.
- OV3 [High] (confidence: 8/10) Archive hides certified works, breaking buyers' certificates. Disposition: resolved by D9 if E5 changes; otherwise archive limited to drafts.
- OV4 [High] (confidence: 9/10) No migration allows `record_edited`/`record_created`; `authenticated` has no INSERT on `provenance_events`; provenance column list undefined (`update-provenance.ts:119-142` includes `display_order`, `is_public`, `is_sold`). Disposition: implementation proof of D18/E6: constraint migration first; trigger is `SECURITY DEFINER` with pinned `search_path`; explicit column list excludes `display_order` (reorder noise). No question.
- OV5 [High] (confidence: 9/10) Prod patched outside migrations (`makerkit/.../supabase/SYNC_VIA_DASHBOARD.sql`, root `FIX_ARTWORKS_POLICIES.sql`, `URGENT_ARTWORKS_FIX.sql`). Disposition: required proof for E2 (D7 A "tests against the exact migrations that ship"): read-only `supabase db dump --schema-only` of prod, diff against a fresh `supabase start`, fold drift into a migration before trusting CI. No question.
- OV6 [High] (confidence: 9/10) Archive-scale extraction undesigned: scans rejected (`extract-exhibition-checklist.ts:96`), 30K truncation (`:99`), 10 per 10 min rate limit, 200 cap (`checklist-parsing.ts:20`), no extraction `maxDuration`. Disposition: new choice E11, D12.
- OV7 [Medium] (confidence: 9/10) `ensureArtistProfileForCertificate` inserts `user_profiles` per row (`create-exhibition-listings.ts:141-151`); messy names create duplicate artist profiles; undo doesn't remove them. Disposition: implementation proof of R9 dedupe (D11 A): importer resolves artist names once per batch with a preview of profiles to be created.
- OV8 [Medium] (confidence: 8/10) Resume idempotency on jsonb has no unique index; batch id is client-supplied. Disposition: implementation proof of E4 (D8 A "retrying never duplicates"): unique index on `(metadata->>'import_batch_id', metadata->>'import_row_index')`; batch id issued server-side.
- OV9 [Medium] (confidence: 8/10) Backfill vs deploy ordering. Disposition: implementation proof of D18: backfill only JSON entries with `editedAt` before trigger install, idempotent by `(artwork_id, editedAt)`; "unrecoverable" label applied only to arrays of exactly 200.
- OV10 [Medium] (confidence: 8/10) TRUNCATE not revoked; FK `set null` actions still rewrite rows. Disposition: implementation proof of D18: revoke TRUNCATE too; FK actions covered by D9/D10 outcome.
- OV11 [Medium] (confidence: 8/10) User actions through the admin client would be labelled system (`admin-delete-artwork.ts:45`, `propagate-provenance.ts:152`). Disposition: reopens E6, D11.
- OV12 [Medium] (confidence: 9/10) T1 depends on T2's insert trigger. Disposition: sequencing fixed: T2 migration -> T1 -> dogfood run.
- OV13 [Low] Overcomplexity of E5-B/E7. Disposition: covered by D9.

#### E8: Who sees history on the certificate
Finding OV2.
State: approved
Actual answer: D10 (eng) free-text: "users should have the ability to make it public or private"
Accepted scope (as interpreted, stated to the user): per-artwork `history_is_public` toggle, default true (keeps today's public history). A DB view serves events for verified artworks to anyone only when the toggle is on, removing changes to value/owned_by/sold_by when their `*_is_public` flag is false. Owner and gallery team always see full history.

#### E11: Archive-scale document extraction
Finding OV6.
State: approved
Actual answer: D12 (eng) A, "Fix every limit"
Accepted scope: scanned PDFs rendered page-by-page to images for the vision model; long text split by page and merged with a visible warning instead of silent cutting; inventory import has its own rate limit (about 60 pages / 10 min); no 200 cap for CSV; maxDuration 60 on extraction.

Approval readiness: PASS — checked E1 (D2), E3 (D5), E4 (D8), E5 (D9), E6 (D11), E7 (superseded by D9), E8 (D10), E11 (D12), E2 (D7), structure (D1); outside-voice proofs OV4, OV5, OV7, OV8, OV9, OV10, OV12 carried as implementation proof of those answers.

### Final design (T2 then T1)

```
DEPLOY ORDER
 1. drift check: supabase db dump --schema-only (prod, read-only) vs supabase start -> fold drift into a migration
 2. migration A: event_type check adds record_edited, record_created, import_undone; drop FK on artwork_id;
                 history_is_public column; set_provenance_actor(); SECURITY DEFINER triggers (pinned search_path);
                 revoke UPDATE, DELETE, TRUNCATE from anon/authenticated/service_role; public history view
 3. CI: supabase start + SQL tests green
 4. deploy app: updateProvenance stops JSON writes; certificate reads view; admin paths call set_provenance_actor
 5. migration B: backfill JSON entries with editedAt < trigger install, idempotent on (artwork_id, editedAt)
 6. T1 importer ships; dogfood run on the founder's gallery

TRIGGER (after update on artworks)
 OLD vs NEW over explicit columns: title, description, artist_name, medium, creation_date, dimensions,
 former_owners, auction_history, exhibition_history, historic_context, celebrity_notes, value, edition,
 production_location, owned_by, sold_by, is_sold, is_public, *_is_public   (display_order excluded)
   no change -> nothing   |  change -> insert record_edited {changed:{col:{from,to}}, snapshot, source}
 actor = auth.uid() ?? current_setting('app.provenance_actor', true) ?? null + source='system'

IMPORT (T1)
 upload ─> server issues batch_id ─> extract (CSV map | PDF text pages | scanned pages -> vision) ─> review grid
   ─> resolve artist names once per batch (preview new profiles) ─> chunks of 25 ─> quiet insert
   (unique index on batch_id,row_index; skip existing) ─> INSERT trigger logs record_created
 undo import ─> delete rows by server batch id ─> import_undone event (history kept, FK dropped)
```

### Failure modes (eng)

```
PATH                   | FAILURE                               | TEST?            | HANDLING           | USER SEES
-----------------------|---------------------------------------|------------------|--------------------|-----------------
trigger insert         | event_type not allowed                | SQL test         | migration A first  | n/a (prevented)
trigger insert         | RLS blocks insert                     | SQL test         | SECURITY DEFINER   | n/a (prevented)
certificate history    | private value leaks publicly          | SQL test (anon)  | view filters       | n/a (prevented)
account deletion       | blocked by FK                         | SQL test         | FK dropped         | n/a (prevented)
backfill               | duplicates or misses during rollout   | SQL test         | cutoff + idempotent| n/a
import chunk           | timeout mid-chunk                     | unit             | resume by row idx  | progress resumes
import double-submit   | duplicate rows                        | SQL test         | unique index       | rows skipped
scanned PDF            | vision returns junk                   | unit (fixture)   | review grid        | rows to fix
long PDF               | rows beyond page budget               | unit             | warning            | visible warning
artist names           | duplicate profiles                    | unit             | per-batch resolve  | preview list
schema drift           | CI green, prod differs                | drift diff step  | fold into migration| n/a
```
No critical gaps: every failure has a test and visible handling.

### Worktree parallelization

| Step | Modules touched | Depends on |
|------|----------------|------------|
| Drift check + migration A + SQL tests + CI job | supabase/migrations, .github/workflows | — |
| App switch to events (updateProvenance, certificate, admin actor calls) | app/artworks, lib/certificate-claims, app/admin | migration A |
| Shared importer + CSV + extraction limits | lib/import, app/exhibitions | — (pure code), merge after migration A for insert events |
| Inventory import page + undo import | app/artworks (new import route) | shared importer, migration A |
| Backfill migration B | supabase/migrations | app switch deployed |

Lane A: drift + migration A + tests → app switch → backfill B. Lane B: shared importer + CSV + extraction (independent code). Then the import page after both. Conflict flag: both lanes touch `app/artworks` late; sequence the import page after the app switch.

### Implementation Tasks (eng)

- [ ] **E-T1 (P1, human: ~1d / CC: ~1h)** — db — Prod schema drift check, then migration A
  - Surfaced by: OV4, OV5, D9, D10, D11
  - Files: makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/ (new)
  - Verify: fresh `supabase start` schema matches prod dump; SQL tests below pass
- [ ] **E-T2 (P1, human: ~1d / CC: ~1h)** — ci — Supabase-in-CI job with SQL tests (edit, insert, actor, revoke incl. TRUNCATE, account delete keeps history, concurrent edits, public view privacy)
  - Surfaced by: finding 17, D7
  - Files: .github/workflows/ (new), supabase/tests (new)
  - Verify: CI fails when the view stops filtering a private value
- [ ] **E-T3 (P1, human: ~1d / CC: ~1h)** — app — Stop JSON writes, certificate reads the history view, `history_is_public` toggle, admin paths call `set_provenance_actor`
  - Surfaced by: D10, D11, finding 11
  - Files: src/app/artworks/[id]/edit/_actions/update-provenance.ts, src/app/artworks/[id]/certificate/page.tsx, src/app/artworks/[id]/certificate/_components/certificate-of-authenticity.tsx, src/lib/certificate-claims/propagate-provenance.ts, src/app/artworks/[id]/_actions/admin-delete-artwork.ts, src/app/admin/reports/_actions/admin-reports.ts
  - Verify: edit as owner shows named entry; anon certificate hides private value change
- [ ] **E-T4 (P2, human: ~3h / CC: ~20min)** — db — Backfill migration B after app deploy
  - Surfaced by: OV9
  - Files: supabase/migrations (new)
  - Verify: running twice yields the same event count
- [ ] **E-T5 (P1, human: ~2d / CC: ~2h)** — import — Shared importer in src/lib/import: CSV (papaparse) mapping, extraction limits (scanned pages, page chunks, own rate limit, no CSV cap, maxDuration), per-batch artist resolution
  - Surfaced by: findings 12, 14, 15, D2, D12, OV7
  - Files: src/lib/import/ (new), src/app/exhibitions/_actions/extract-exhibition-checklist.ts, src/app/exhibitions/_helpers/checklist-parsing.ts, src/app/exhibitions/_actions/create-exhibition-listings.ts, package.json
  - Verify: exhibition import regression test still links rows; scanned PDF fixture returns rows
- [ ] **E-T6 (P1, human: ~1d / CC: ~1h)** — import — Inventory import page: server batch id, chunks of 25 with resume, unique index, undo import
  - Surfaced by: D8, OV8, D9
  - Files: src/app/artworks/import/ (new), migration for unique index
  - Verify: double-submit creates no duplicates; undo removes rows and keeps history

### NOT in scope (eng)

- Collectibles, vehicles and properties `provenance_history` columns (never written today): not migrated to events in this wave.
- Background-job imports: chunked browser loop chosen instead (D8).
- Excel .xlsx: CSV only (D2).

### What already exists (eng)

- `provenance_events` table + index + owner RLS: reused (D1).
- `createQuickExhibitionListings` quiet draft create: becomes the shared importer core (D1).
- `extractExhibitionChecklist` + `normalizeChecklist`: moved and extended (D12).
- `checklist-parsing.test.ts`: kept and extended.

### Completion summary (eng)

```
  Step 0 scope challenge   | scope accepted as-is; smaller arrangement (D1)
  Architecture             | 4 issues (findings 8-11)
  Code quality             | 5 issues (findings 12-16)
  Tests                    | diagram produced; 1 gap resolved (D7)
  Performance              | 2 issues (D8; backfill size to re-measure)
  NOT in scope             | written
  What already exists      | written
  TODOS.md updates         | 0 proposed
  Failure modes            | 0 critical gaps flagged
  Outside voice            | codex unavailable; native fallback, 13 findings, all dispositioned
  Parallelization          | 2 lanes, 1 sequential join
  Lake Score               | 1/1 (D7, complete option)
  Decisions                | 12 asked (D1-D12), 0 unresolved
```

### REALITY rows (eng)

- REALITY: premise-table pass every claim cited to file:line; unverified=1 (backfill size) makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250103000000_create_artworks.sql:24
- REALITY: already-done finding provenance_events and quiet create already exist (reused) makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20260428000000_provenance_events_and_invite_batches.sql:88
- REALITY: surface-check pass supabase CLI 2.75.0 has `start`, `db dump`, `db push` (db query absent, not used) docs/roadmap-ceo-review-2026-10-19.md:1
- REALITY: binding-decisions pass CEO D12/D18 honored; D18 mechanism refined, guarantees kept docs/roadmap-ceo-review-2026-10-19.md:44
- REALITY: numbers pass 97 files / 39 status refs / 44 verified filters [measured: grep]; efforts [estimated] src/app/artworks/[id]/certificate/page.tsx:134
- REALITY: deferred-asks pass no linked issue docs/roadmap-ceo-review-2026-10-19.md:171
- REALITY: pr-count pass default one PR per wave; 2 lanes merge into one wave docs/roadmap-ceo-review-2026-10-19.md:171
- REALITY: transaction-semantics pass set_provenance_actor uses set_config(..., true), transaction-local; supabase-js calls are one transaction per RPC makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20260428000000_provenance_events_and_invite_batches.sql:100

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | ISSUES OPEN | mode: SCOPE_REDUCTION, 3 critical gaps (all with approved owners) |
| Outside Review | codex (not installed) → native Plan fallback | Independent 2nd opinion | 2 | unavailable (native fallback completed both times) | CEO: 12 native findings, all resolved; Eng: 13 native findings, all dispositioned; no completed external review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | T1+T2: 19 findings + 13 outside, 0 critical gaps, 0 unresolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review, unavailable (CLI not installed) in both CEO and Eng phases. The native Plan-agent fallback completed each time; it counts as in-host review, not outside coverage.
- **VERDICT:** ENG CLEARED for T1 + T2 — ready to implement in the deploy order above. CEO review open items are owned by approved tasks.

NO UNRESOLVED DECISIONS
