# Institution accounts and institution teams

Status: Phases 1–3 built (2026-10-29). Phase 4 (staging test pass) and the migration push are still to do.

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

### Phase 1: fix the certificate bug (DONE, committed fc2c008)

- `posterRequiresArtistClaim(role)` and `getInitialCertificateStatus(role)` in `user-roles.ts`, tested in `user-roles.test.ts`.
- `createArtworksBatch`, `createArtwork` (no callers, fixed anyway), and `publishExhibitionListing` all use the helper. Institution batch posts now get `pending_artist_claim`, artist profile resolution, an unclaimed registry profile, the claim notification, and the poster's own institution `gallery_profile_id`.
- Backfill: not needed. The live DB has 1 institution profile and 0 Certificates of Show posted by institution accounts (checked 2026-10-29).

### Phase 2: locked institution accounts (BUILT 2026-10-29, uncommitted, migration not pushed)

Decided: admin-only lock; institution staff are not locked.

- Lock flag: `accounts.public_data.account_type = 'institution'`. Helpers in `src/lib/institution-account.ts` (pure, tested) and `src/lib/institution-account-guard.ts` (server check, `getInstitutionLockError`).
- Database (`20261029000000_institution_accounts_and_teams.sql`), same pattern as `protect_admin_flag`:
  - `kit.protect_institution_account_lock` on `accounts`: authenticated users cannot set or clear `account_type`, and a locked account's `role` must stay `institution`. Only the service role changes it.
  - `kit.protect_institution_account_profiles` on `user_profiles`: a locked account can only own institution profiles. Unclaimed artist profiles (`user_id` null) are unaffected.
  - Because the role can't leave `institution`, the existing artist-only checks (claiming certificates, claiming artist profiles) already refuse locked accounts.
- Server checks: `updateUserRole`, `createProfile`, `createArtworksBatch` (checks the submitted `posterRole`, not just the DB role), `createArtwork`, `createExhibition` (owner options), `submitOpenCall`, and exhibition invite submissions.
- Admin: "Lock as institution account" / "Remove institution lock" on `/admin/users` (`setInstitutionAccount`). Locking also switches the account into institution mode.
- UI for locked accounts: add-artwork page and collection page have no mode switcher and stay in institution mode; the account dropdown lists only institution profiles and resets a stale browser mode to institution; `/profiles/new` redirects to institution; exhibitions offer only the Institution owner.

### Phase 3: institution teams (BUILT 2026-10-29, uncommitted, migration not pushed)

- Same migration: `role in ('gallery', 'institution')` in `is_gallery_owner_or_admin`, `is_gallery_member_for_artwork`, `is_gallery_member_for_exhibition`, `user_profiles_update_own`, and `auto_add_gallery_owner` (+ trigger `when`). Owner rows backfilled for existing institution profiles.
- App code: `TEAM_PROFILE_ROLES` / `isTeamProfileRole` in `user-roles.ts`, used by `gallery-members.ts`, `get-user-gallery-profiles.ts` (now takes `roles`), `get-open-calls-for-gallery.ts`, `get-user-exhibitions.ts`, `update-exhibition.ts`, `canAttachGalleryProfile`, and the profile edit page.
- The add-artwork "Post as" picker lists gallery profiles in gallery mode and institution profiles in institution mode. The collection page loads only the active mode's team profiles.
- Invite notification, email, and the team panel say "institution" for institution profiles.
- Team bugs fixed along the way (apply to galleries too):
  - The last owner could remove themselves, leaving no owner. Now refused.
  - Admins could promote anyone to owner. Now only owners (or the profile creator) can add or remove owners; admins still switch people between member and admin.

### Phase 3b: feature parity with galleries (BUILT 2026-10-30, uncommitted)

Audit of every gallery-only check in the app; institutions now get the same:

- Public profile page: `?role=institution` is honored (it fell back to the account's main role), with the organization layout, exhibitions, latest COS, and institution wording.
- Certificates: credit the gallery / institution profile the work was posted under (not the poster's current mode), "Uploaded by Institution", link to the profile owner's page (right for team posts). Institutions can verify certificates; the certificate's exhibition names the institution.
- Add artwork: exhibition picker, past-artist list, registry backfill, and linking to an existing COA.
- Artist profile claims: institutions see and approve claims on artist profiles they created. Exhibitions: add an artist by name; back links and share cards name the institution.
- Open calls: institutions can create and manage them; the open call's exhibition is an institution show.
- Profile sites: team members can edit, publish, preview, and transfer handles; the site lists the institution's exhibitions; the Cabinet template says "Institution".
- Portal: institution profiles count toward the organization market cap; the "create profile" prompt targets institutions.

Not changed, on purpose or for later:
- /registry: the Galleries section is a hand-picked list (only FL!ght today), and institutions aren't added automatically. Institutions don't show as artists, because that section counts COAs only.
- Public slug URLs (`/g/<slug>`) stay gallery-only.
- "Send to gallery" search, the "Using gallery" label, landing stats, and the sitemap still mean galleries only.
- The sales page's Collectors link belongs to the collectors work in progress.

### Phase 4: test the ins and outs

Automated (vitest, next to the helpers):
- `certificateStatusForPoster` for all four roles.
- `getExhibitionOwnerRoleOptions` for locked and unlocked accounts.
- The `updateUserRole` lock check.

Migration checked 2026-10-29 against a throwaway local Postgres with a minimal schema: cases 1, 4, 7, 10, 11, 12 (DB side) and the lock triggers behave as expected. Still needs the full app pass below.

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
