# Institution accounts and institution teams

Status: DRAFT (2026-10-29). Items marked **[PENDING]** need Tim's call before building.

## Problem (from Tim)

1. An institution login should not be able to post as an artist or collector.
2. Teams need to work, and be tested, at the institution level.

## What exists today

- `institution` is a fourth role in `src/lib/user-roles.ts`, stored in `accounts.public_data.role`.
- That field is the **current mode**, not a fixed account type. `PerspectiveSwitcher` writes it on every switch through `updateUserRole` (`src/app/onboarding/_actions/update-user-role.ts`), which accepts any valid role with no checks. So every account can be all four roles.
- Exhibitions always offer the Gallery and Artist owner options, whatever the current mode (`getExhibitionOwnerRoleOptions` in `src/app/exhibitions/_helpers/exhibition-owner-roles.ts`).
- Institution profiles are `user_profiles` rows with `role = 'institution'`. They show up in the account dropdown and the profile form.

### Bug: institution certificates skip the artist claim

- `createArtwork` (`src/app/artworks/add/_actions/create-artwork.ts:82`) sends only collector and gallery through `pending_artist_claim`. Institution posts get a Certificate of Show with `certificate_status = 'verified'` and no artist lookup.
- `createArtworksBatch` (`create-artworks-batch.ts:229`) has the same gap. Only the collector and gallery branches exist, so institutions fall through to `verified`.
- The add-artwork page tells institutions "the artist will need to claim the certificate", so the screen contradicts the data.

### Teams are gallery-only at every layer

| Layer | Where | The gallery-only check |
|---|---|---|
| Owner auto-add trigger and backfill | `20250126000000_add_gallery_members.sql` | `when (new.role = 'gallery')` |
| Team RLS helper | `is_gallery_owner_or_admin` in `20250131000000_fix_gallery_members_rls_recursion.sql` | `up.role = 'gallery'` |
| Artwork and exhibition RLS helpers | `is_gallery_member_for_artwork` and `is_gallery_member_for_exhibition` in `20250126000001_update_rls_for_gallery_members.sql`, plus the `user_profiles_update_own` policy | `up.role = 'gallery'` |
| Invite, manage, and check actions | `src/app/profiles/_actions/gallery-members.ts` (`inviteGalleryMember`, `canManageGallery`, `canManageExhibition`) | `.eq('role', 'gallery')` |
| Posting check | `canAttachGalleryProfile` in `src/app/exhibitions/_actions/gallery-posting-context.ts:66` | Rejects institution profiles outright |
| Profiles a member can post under | `src/app/artworks/add/_actions/get-user-gallery-profiles.ts:22,65` | `.eq('role', GALLERY)` |
| Open calls | `src/app/open-calls/_actions/get-open-calls-for-gallery.ts:27` | `.eq('role', GALLERY)` |
| Notification and email copy | `inviteGalleryMember` | Says "gallery" and "Switch to Gallery mode" |

## Plan

### Phase 1: fix the certificate bug (DONE 2026-10-29, uncommitted)

- `posterRequiresArtistClaim(role)` and `getInitialCertificateStatus(role)` in `user-roles.ts`, tested in `user-roles.test.ts`.
- `createArtworksBatch`, `createArtwork` (no callers, fixed anyway), and `publishExhibitionListing` all use the helper. Institution batch posts now get `pending_artist_claim`, artist profile resolution, an unclaimed registry profile, the claim notification, and the poster's own institution `gallery_profile_id`.
- Backfill: not needed. The live DB has 1 institution profile and 0 Certificates of Show posted by institution accounts (checked 2026-10-29).

### Phase 2: locked institution accounts

- Add an account type that is separate from the current mode, for example `accounts.public_data.account_type = 'institution'`. Unset means "individual", which keeps today's switching behavior.
- `updateUserRole` refuses any role other than `institution` when the account type is institution. This is the authoritative check.
- Defense in depth in the posting code: `createArtwork`, `createArtworksBatch`, `createExhibition`, and the open-call submission action read the account type and refuse artist or collector posting.
- `PerspectiveSwitcher` is hidden for institution accounts. The account dropdown shows only institution profiles.
- `getExhibitionOwnerRoleOptions` returns `['institution']` only.
- Onboarding: how an account becomes an institution account. **[PENDING]** Options:
  - **A (recommended):** admin-only. Add an "Institution account" toggle to `admin/users/_components/user-access-manager.tsx`, set while onboarding a museum. No individual can lock themselves in by mistake.
  - B: the onboarding "Institution" choice sets the lock, after an "this account can't post as an artist or collector" confirm step.
- Existing accounts currently in institution mode stay individual until flagged. Run a read-only count first.

### Phase 3: institution teams (reuse `gallery_members`)

Keep the `gallery_members` table and its owner/admin/member roles. Widen the gallery checks so they accept institution profiles as well, rather than building a second team system.

- New migration (data-safe: `create or replace function`, and drop and recreate policies only):
  - `role = 'gallery'` becomes `role in ('gallery', 'institution')` in `is_gallery_owner_or_admin`, `is_gallery_member_for_artwork`, `is_gallery_member_for_exhibition`, `user_profiles_update_own`, and `auto_add_gallery_owner` (the function and the trigger's `when` clause).
  - Backfill an owner row for existing institution profiles.
- App code: make the same change in `gallery-members.ts`, `get-user-gallery-profiles.ts`, `get-open-calls-for-gallery.ts`, and `canAttachGalleryProfile`. Remove the institution early return there.
- Notification and email copy uses the profile's role ("institution", "Switch to Institution mode").
- The team management UI on the profile edit page renders for institution profiles too.
- Staff accounts: is a member of an institution team locked too? **[PENDING]** Recommended: no. Staff keep their personal accounts, which can be artist or collector. Anything they post *in institution mode* under that profile is attributed to the institution. Only the institution's own account is locked.

### Phase 4: test the ins and outs

Automated (vitest, next to the helpers):
- `certificateStatusForPoster` for all four roles.
- `getExhibitionOwnerRoleOptions` for locked and unlocked accounts.
- The `updateUserRole` lock check.

Manual QA on staging. Accounts: **I** (institution account, locked), **S1** and **S2** (staff with personal accounts), **X** (unrelated user).

| # | Case | Expected |
|---|---|---|
| 1 | I tries to switch mode (UI hidden; call `updateUserRole('artist')` directly) | Refused, role stays institution |
| 2 | I adds an artwork | COS with `pending_artist_claim`, artist gets a claim invite |
| 3 | I creates an exhibition | Only the Institution owner option is offered |
| 4 | I invites S1 as admin and S2 as member | Both get the notification and email with institution wording |
| 5 | S1 posts an artwork under the institution profile | Allowed, `gallery_profile_id` = the institution profile |
| 6 | S2 (member) posts and edits the institution's artworks | Allowed per the member role. Can't manage the team |
| 7 | S2 tries to invite or remove someone | Refused by the action and by RLS |
| 8 | S1 (admin) changes S2 to admin | Allowed. Only owners can create owners |
| 9 | S1 removes S2. S2 posts again | Refused, institution profile gone from S2's picker |
| 10 | Last owner tries to leave or demote themselves | Refused |
| 11 | X tries to post under the institution profile (forged `galleryProfileId`) | Refused by `canAttachGalleryProfile` and RLS |
| 12 | S1 switches to artist mode on their personal account | Still works. Institution posting is not offered there |
| 13 | Gallery teams regression: rerun 4–11 on a gallery profile | Unchanged |
| 14 | iOS app: cases 1, 2, 5 | Same as web |

## Order and size

Phase 1 alone: about half a day. Phases 2 and 3 together: one PR with one migration, pushed with `supabase db push` after review. Phase 4 runs on staging before that migration reaches the live DB.
