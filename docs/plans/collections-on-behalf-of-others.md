# Collections created on behalf of someone else

Status: DRAFT (2026-10-29). **Decided:** v1 ships both handoff modes (forward and share), with collector teams landing alongside institution Phase 3. Items marked **[PENDING]** still need Tim's call.

## Problem (from Tim)

A user sometimes needs to build a collection for someone else: an advisor cataloguing a client's works, a gallery registering a buyer's purchases, a registrar or estate manager working for a family, an assistant working for a collector. When the work is done, one of two things has to happen:

1. **Forward it.** The collection goes to the real owner, and the creator can step away.
2. **Share it.** The real owner owns the collection, and the creator stays on as a teammate.

## What exists today

- **"Collection" is not a table.** A collection is a collector `user_profiles` row plus the artworks its account owns. Ownership is `artworks.account_id`, which is an `auth.users` id. Every owner-only RLS policy checks `account_id = auth.uid()` (`20250103000000_create_artworks.sql`).
- **One collector profile per user.** `20250120000000_allow_multiple_galleries.sql` adds the partial unique index `user_profiles_user_role_unique_artist_collector` on `(user_id, role) where role in ('artist','collector')`. About 16 files look up "the" collector profile (`role-switcher.tsx`, `send-certificate.ts`, `create-invite-batch.ts`, `artworks/my/page.tsx`, the Stripe webhook, and more).
- **Collector posts don't record a profile.** `create-artworks-batch.ts:337` only sets `gallery_profile_id` when `posterRequiresArtistClaim(role)` is true, which means gallery or institution. Collector certificates start as `verified` (`getInitialCertificateStatus`).
- **The certificate owner name is the account name.** `artworks/[id]/certificate/page.tsx:278` swaps in a profile name only for galleries. A collector's certificate shows `accounts.name`.
- **Unclaimed profiles exist, but only for artists.** `20250122000000_add_artist_profile_claims.sql` lets `user_profiles.user_id` be null, and adds `is_claimed`, `created_by_gallery_id`, and `artist_profile_claims`.
- **Token email invites exist.** `certificate_claim_invites` (`20250325000000`) is a hashed-token, expiring, email-matched invite with no RLS policies (admin client only). `consume-certificate-claim.ts` does the claiming. `artwork_shares` uses the same pattern.
- **Teams exist, but only for galleries.** `gallery_members` (owner/admin/member) plus `is_gallery_member_for_artwork(account_id, gallery_profile_id)`. Institution plan Phase 3 widens `role = 'gallery'` to `role in ('gallery','institution')`.
- **Moving a whole profile has a precedent.** `transferHandleAction` (`src/app/profile/site/_actions/transfer-handle.ts`).
- **Gap:** nothing can change `artworks.account_id` in bulk, and no flow exists to hand a collector profile to another person.

## Design: one primitive for both modes

A **managed collection** is a collector profile that one user builds for another, then hands off with an email invite. When the creator sends the invite, they choose what happens to them after it's accepted:

```
Creator builds a          Owner accepts the handoff invite
managed collection ──▶ ├─ forward: owner gets everything, creator is removed
(unclaimed profile)    └─ share:   owner gets everything, creator stays as admin or member
```

Either way, the **owner's account becomes `account_id`** on every artwork. Certificates, portfolio value, market-cap graphs, and RLS all read that column as "the owner", so the creator never stays the legal owner of someone else's art.

## Phases

### Phase 1: managed collector profiles (BUILT 2026-10-29, uncommitted; migration pushed to the live DB 2026-10-29)

What landed:
- Migration `20261029100000_managed_collector_profiles.sql`: adds `managed_for_name` / `managed_for_email` and swaps the uniqueness index to `... and is_claimed`.
- `getUserProfiles` and `getUserProfileByRole` skip managed profiles. New `getManagedCollections`. The same filter was added in `create-profile.ts`, Taco's `handleUpdateArtistBio`, and `artists/[id]/page.tsx`. A scan of every `user_id` + `role` single-row lookup found no others that can return a collector.
- `createManagedCollection` action, plus a "Collections you manage for others" card on `/profiles` (hidden for locked institution accounts).
- Add-artwork, in Collector mode: an "Add to collection" picker (My collection or a managed one), preselected from `?collection=`. `createArtworksBatch` refuses a collection the poster doesn't manage instead of silently falling back.
- The certificate page names the collection's owner when `gallery_profile_id` points at a collector profile.
- Tests: `src/lib/managed-collections.test.ts`.

Not verified: the signed-in flows in a browser. The migration is live, so this can now be tested against the live DB in local dev, signed in.

Note for Phase 2: `user_profiles_update_own` lets the creator set `is_claimed = true` on their own managed profile. That's harmless (it just becomes their collector profile, and the index blocks a second one), but the accept function should not trust `is_claimed` alone.

**Migration**
- Add `user_profiles.managed_for_email text` and `managed_for_name text`. A managed profile has `role = 'collector'`, `user_id = creator`, and `is_claimed = false`. `user_id` stays set to the creator rather than null, so every existing `account_id = auth.uid()` policy keeps working while the creator builds.
- Drop and recreate the collector uniqueness index as `where role in ('artist','collector') and is_claimed`. A creator can then hold any number of managed collections next to their own collector profile, while still having only one *claimed* collector profile.
- Read-only check first: count rows where `is_claimed = false and role = 'collector'`. Expected: 0.

**Keep managed profiles out of "my collector profile" lookups**
- The ~16 single-collector lookups add `.eq('is_claimed', true)`. Without it, `.single()` errors once a creator has a managed profile. Put it in one helper (`getOwnCollectorProfile`) next to `getUserProfileByRole` rather than editing each query by hand.

**Posting into a managed collection**
- In the add-artwork and batch flows, allow `gallery_profile_id` for a collector profile when the poster manages it. That's a separate check from `posterRequiresArtistClaim`, so certificate status stays `verified`, as for any collector post.
- The profile picker on the add-artwork page lists "Collections you manage" under the creator's own collector profile.

**Certificates show the real owner**
- `certificate/page.tsx`: when `artworks.gallery_profile_id` points at a collector profile, use that profile's name, whether the profile is managed or claimed. Make the same change in `send-certificate.ts` and the PDF/printable owner line.

**UI**
- "Create a collection for someone else" in the profile switcher. It takes the owner's name and an optional email (the email can be added at handoff).
- The managed collection shows a "Managed for {name}, not yet handed off" banner.

### Phase 2: the handoff invite

**Table**
- `collection_handoff_invites`, a copy of the `certificate_claim_invites` shape: `profile_id`, `invitee_email`, `token_hash`, `status`, `expires_at`, `created_by`, `mode` (`'forward' | 'share'`), `creator_role_after` (`'admin' | 'member' | null`), `consumed_by`, `consumed_at`. RLS on, no policies.

**Rules**
- The creator picks the mode when sending. On the accept screen the owner can downgrade "share" to "forward" (remove the creator), but never upgrade it.
- Accept at `/claim/collection?token=…`, reusing the auth bounce and the `hashClaimToken` / `emailsMatch` checks from `consume-certificate-claim.ts`.
- Resend, cancel, and expiry work like `manage-owner-invites.ts`. The creator keeps editing until the invite is accepted.

**Accept is one transaction**: a `security definer` function `accept_collection_handoff(invite_id, new_owner uuid)`. It picks a target profile:
- **The owner has no collector profile:** the managed profile becomes theirs (`user_id = new_owner`, `is_claimed = true`, clear `managed_*`).
- **The owner already has a collector profile: merge.** The uniqueness index requires this, and the ~16 single-collector lookups assume it. Artworks move to the owner's existing profile, and the managed profile is deleted. **[PENDING]** Confirm merging is acceptable. Keeping them separate would mean allowing several claimed collector profiles per user, and touching every lookup.

Then, inside the same transaction:
1. `artworks`: `account_id = new_owner`, `gallery_profile_id = target profile`, for every work in the managed profile.
2. Owner-side records that belong to those artworks follow them (`account_id = new_owner`):
   - **Move:** `artwork_attachments`, `artwork_tags` (and the creator's `tags` used only by those works are copied to the owner), `artwork_valuations`, `artwork_locations`, `condition_reports`, `insurance_valuations`, `acquisitions`, `consignments`, `artwork_shipments`, `artwork_loan_agreements`, `artwork_inquiries`, `artwork_image_embeddings`.
   - **Don't move:** `artwork_favorites` and `artwork_impressions` (they record the viewer, not the owner), `artwork_feed_boosts` (paid by the creator), and `provenance_events` (`account_id` there is the actor, and history stays as written).
   - **[PENDING]** `invoices` and `sales_ledger`: these are the creator's business records, for example a gallery invoicing the buyer. Recommended: don't move them.
   - Each "move" table gets one line in the function. Before writing it, check that each table's `account_id` really means the owner.
3. `gallery_members`: the owner is inserted as `owner`. In share mode, the creator gets `creator_role_after`. In forward mode, the creator gets no row.
4. The invite is marked consumed, and one `provenance_events` row is written per artwork: "Catalogued by {creator} on behalf of {owner}". That's an administrative note, not an ownership change.

### Phase 3: collector teams (ships with institution Phase 3)

- In the migration that widens team checks for institutions, use `role in ('gallery','institution','collector')` in `is_gallery_owner_or_admin`, `is_gallery_member_for_artwork`, `is_gallery_member_for_exhibition`, and `user_profiles_update_own`. Don't widen `auto_add_gallery_owner` to collectors. Collector teams only start from a share-mode handoff or an owner's invite, so ordinary collectors don't all get a team row.
- **Members post as the owner.** When a team member posts into a collection, `account_id` is the profile's owner, not the poster. That needs:
  - an artworks insert policy that allows `account_id = <profile owner>` when `is_gallery_member_for_artwork(account_id, gallery_profile_id)` is true, and
  - the posting actions to resolve `account_id` from the selected profile instead of `auth.uid()`.
  This is the riskiest change in the plan, because it touches the core posting path for every role. It gets its own tests.
- Team UI: the gallery team section on the profile edit page renders for collector profiles. The copy reads "collection team".
- **[PENDING]** Private values (`value_is_public = false`, portfolio value): recommended visible to the owner and admins, hidden from members.

### Phase 4: tests and QA

**Automated (vitest)**
- Token hashing, expiry, and email mismatch (reuse the existing claim token tests).
- Mode rules: an owner can downgrade "share" to "forward", but not the other way.
- The target-profile choice: new profile vs. merge.
- `account_id` resolved from the selected profile in the posting actions, for all four roles.
- `getOwnCollectorProfile` ignores managed profiles.

**Manual QA on staging.** Accounts: **C** (creator, who also has their own collector profile), **O** (owner, no account yet), **O2** (owner with an existing collector profile), **X** (unrelated user).

| # | Case | Expected |
|---|---|---|
| 1 | C creates two managed collections and adds works to each | Both allowed. C's own collector profile is unaffected |
| 2 | Certificates in a managed collection | Show the owner's name, not C's |
| 3 | C switches roles, sends a certificate, opens My artworks | No errors from the single-collector lookups |
| 4 | C sends a forward invite. O signs up from the link and accepts | O owns the profile, the works, and the moved records. C loses access |
| 5 | Same, in share mode with C as admin | O is owner, C is admin, C can still edit and post |
| 6 | C (admin) posts a new work | `account_id` = O, `gallery_profile_id` = the collection |
| 7 | O downgrades share to forward at accept | C is removed |
| 8 | O2 accepts | Works merge into O2's existing profile, and the managed profile is gone |
| 9 | X opens O's link while signed in as X | Refused (email mismatch) |
| 10 | Expired or cancelled invite | Refused, C can resend |
| 11 | O removes C from the team later | C loses access, the works stay with O |
| 12 | Provenance chain on a handed-off work | O is the owner. C appears only as "catalogued on behalf of" |
| 13 | Portfolio value and market-cap graphs | Counted under O, not C |
| 14 | Gallery and institution team regression | Unchanged |
| 15 | iOS app: cases 4, 5, 6 | Same as web |

## Order and size

1. **Phase 1:** about 2 days. One migration (columns plus the index swap) and the lookup helper.
2. **Phase 2:** about 2 days. One migration (the table plus the accept function).
3. **Phase 3:** about 2 days, in the same PR and migration as institution Phase 3.
4. **Phase 4** runs on staging before any of these migrations reach the live DB with `supabase db push`.

Phases 1 and 2 can ship before Phase 3. Forward mode works end to end without teams. Share mode just creates the team row early, and it takes effect when Phase 3 lands.
