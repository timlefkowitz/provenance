# Gallery team access

Gallery profiles can have **team members** who can manage that gallery’s collection, post Certificates of Show, and manage exhibitions. This document describes the data model and how to use the permission helpers in code.

## Data model

- **`user_profiles`** – Each gallery is a row with `role = 'gallery'`. The profile’s `user_id` is the gallery “owner” account.
- **`gallery_members`** – Links a user (`user_id`) to a gallery profile (`gallery_profile_id`) with a `role`: `owner`, `admin`, or `member`. The gallery profile creator is automatically added as an `owner`.
- **`artworks`** – When a gallery (or a team member) posts work, the row has `account_id` (posting account) and optionally **`gallery_profile_id`** (the gallery profile the work belongs to). Certificates of Show use `certificate_type = 'show'` and typically have `gallery_profile_id` set.

If you want a collaborator to manage your gallery’s collection and Certificates of Show, add them as a team member on that gallery profile (edit profile → Team members).

## Permission helpers

All live in **`src/app/profiles/_actions/gallery-members.ts`**. Use them in server actions and API routes; do not rely only on client-side checks.

| Helper | Purpose |
|--------|--------|
| **`isGalleryMember(userId, galleryProfileId)`** | Returns whether the user has any membership on that gallery profile (any role). |
| **`canManageGallery(userId, galleryProfileId)`** | Returns whether the user can manage the team (profile owner or `gallery_members` role `owner` or `admin`). Use for: inviting/removing members, updating roles. |
| **`canEditGalleryArtworks(userId, artwork)`** | Returns whether the user can edit/delete the artwork. `artwork` must have `account_id` and optional `gallery_profile_id`. Use for: delete artwork, update provenance, edit artwork from certificate page. |
| **`canManageExhibition(userId, exhibitionGalleryId)`** | Returns whether the user can manage the exhibition. `exhibitionGalleryId` is `exhibitions.gallery_id` (the gallery account id). Use for: updating exhibition details when editing an artwork. |

## Where to use them

- **Creating artworks as a gallery** – When `galleryProfileId` is present, the create-artwork flow already ensures the current user owns the profile or is in `gallery_members`; no extra helper required.
- **Deleting an artwork** – Use `canEditGalleryArtworks(currentUser.id, { account_id, gallery_profile_id })`; then delete by artwork `id` (RLS will allow owner or gallery member).
- **Editing an artwork / provenance** – Use `canEditGalleryArtworks` for the artwork; use `canManageExhibition` when updating exhibition data.
- **Verifying a certificate** – For Certificates of Show, allow verification if the user is the artwork owner or `canManageGallery(userId, artwork.gallery_profile_id)`.
- **Listing “my” artworks** – Do not filter by `account_id` only; query with `status = 'verified'` and let RLS return rows the user can read (owner or gallery member via `is_gallery_member_for_artwork`).

## RLS

Supabase RLS on `artworks`, `exhibitions`, and related tables already allows gallery members to read/update/delete where appropriate. The DB helper `is_gallery_member_for_artwork(account_id, gallery_profile_id)` and `is_gallery_owner_or_admin(p_gallery_profile_id)` are used in policies. Server-side checks with the helpers above keep behavior consistent and make intent clear in app code.
