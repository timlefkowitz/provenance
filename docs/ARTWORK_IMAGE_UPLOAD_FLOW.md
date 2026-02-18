# How Artwork Images Are Added to the Database

## Overview

Artwork images are stored in **Supabase Storage** (bucket `artworks`). The **public URL** of each uploaded file is saved in the `artworks` table as `image_url`. There are **two entry points** that write `image_url`; both use the same storage bucket and similar upload logic, but the code is duplicated in three places.

---

## 1. Add Artwork (batch) — main flow

**UI:** Add Artwork form (`src/app/artworks/add/_components/add-artwork-form.tsx`)

**Flow:**
1. User selects one or more images (files stay in browser as `File`).
2. Form submits via `createArtworksBatch(formDataToSend, userId)`.
3. **Server:** `src/app/artworks/add/_actions/create-artworks-batch.ts`
   - Reads `FormData`: `images` (File[]), `titles`, `locations`, plus metadata (description, artistName, medium, etc.).
   - For each image:
     - Calls **local** `uploadArtworkImage(client, imageFile, userId)` → uploads to Supabase Storage bucket `artworks`, returns public URL.
     - Inserts a row into `artworks` with `image_url: imageUrl` (and title, certificate_number, etc.).
   - Returns created artwork IDs; form redirects to certificate or feed.

**Database:** `artworks` table gets new rows with `image_url` = public Supabase Storage URL (e.g. `https://<project>.supabase.co/storage/v1/object/public/artworks/<userId>/<timestamp>-<random>.<ext>`).

---

## 2. Edit Artwork (change image)

**UI:** Certificate page → Edit artwork dialog (`edit-artwork-dialog.tsx`) when user uploads a new image.

**Flow:**
1. User opens edit dialog and selects a new image file.
2. Form submits via `editArtwork(artworkId, formData, isCreator)`.
3. **Server:** `src/app/artworks/[id]/certificate/_actions/edit-artwork.ts`
   - If form contains a new image file:
     - Calls **local** `uploadArtworkImage(client, imageFile, user.id)` → same bucket `artworks`, new file path.
     - Updates existing row: `artworks` set `image_url = imageUrl` where `id = artworkId`.
   - Other fields (title, artist_name, etc.) are also updated as needed.

**Database:** Existing `artworks` row is updated; `image_url` points to the new file in the same bucket (old file is not deleted).

---

## 3. Create single artwork (unused)

**File:** `src/app/artworks/add/_actions/create-artwork.ts`

- Exports `createArtwork(formData, userId)` which expects one `image` in FormData, uploads via its **own local** `uploadArtworkImage`, then inserts one row into `artworks`.
- **Not used anywhere:** the add-artwork form only calls `createArtworksBatch`. This is effectively dead code unless another UI is added that calls `createArtwork`.

---

## Shared vs duplicated code

| Piece | Shared? | Where |
|-------|--------|--------|
| Bucket name `artworks` | Yes | `src/lib/artwork-storage.ts` (`ARTWORKS_BUCKET`) |
| Content-Type / extension from file | Yes | `artwork-storage.ts` → `getContentTypeAndExtension()` |
| Public URL from path | Yes | `artwork-storage.ts` → `getArtworkImagePublicUrl()` |
| Upload logic (bucket create, upload, return URL) | **Yes** | `artwork-storage.ts` → `uploadArtworkImage(client, adminClient, file, userId)` |

All three entry points call the shared `uploadArtworkImage(client, adminClient, file, userId)` in `artwork-storage.ts`.

So: **one storage bucket, one DB column (`image_url`), but three separate implementations of “upload file and return URL”.**

---

## Migrations that cover artwork upload

These Supabase migrations create and update the `artworks` table, `image_url`, the **artworks** storage bucket, and RLS. Run them in order (Supabase only runs migrations that haven’t been applied).

| Migration | What it does for artwork upload |
|-----------|----------------------------------|
| **20250103000000_create_artworks.sql** | Creates `public.artworks` (with `image_url`), RLS (read own, read verified, insert, update, delete), **storage bucket `artworks`** (public), and storage RLS (read anon+auth, insert/update/delete for `userId/...`). |
| 20250106000000_add_artwork_privacy.sql | Adds `is_public`; updates `artworks_read_public` to require `is_public`. |
| 20250108000000_ensure_anon_artworks_access.sql | Grants anon SELECT on `artworks`. |
| 20250110000000_add_notifications_and_certificate_workflow.sql | Adds certificate workflow columns to `artworks`. |
| 20250111000000_add_artwork_additional_fields.sql | Adds extra columns to `artworks`. |
| 20250123000000_add_gallery_profile_id_to_artworks.sql | Adds `gallery_profile_id` to `artworks`. |
| **20250126000001_update_rls_for_gallery_members.sql** | Replaces artworks RLS so gallery members can insert/update/delete for their gallery’s artworks; keeps public read for verified+public. |
| 20250126000004_ensure_anon_artworks_visibility.sql | Ensures anon can see verified public artworks. |
| 20250213000001_add_certificate_type_to_artworks.sql | Adds `certificate_type` to `artworks`. |

**How to run migrations**

From the app that has the migrations:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
npx supabase db push
```

Or: `supabase migration up` (with CLI linked to your project).

Supabase records applied migrations and **does not** re-run them. To “run them again”: use a different project or reset the DB (migrations run from scratch), or add a **new** migration to fix a policy/schema. If uploads fail with “bucket not found” or permission errors, ensure **20250103000000_create_artworks.sql** and **20250126000001_update_rls_for_gallery_members.sql** (if using galleries) have been applied.

---

## Summary

- **Multiple sources for “adding” an image to the DB:**  
  - **Add flow:** new rows via `createArtworksBatch` (only path used by the current add form).  
  - **Edit flow:** update existing row via `editArtwork`.  
  - **Single-artwork create:** `createArtwork` exists but is unused.
- **Database:** All image URLs are stored in `artworks.image_url`; they point to Supabase Storage `artworks` bucket.
- **Done:** Upload logic lives in `src/lib/artwork-storage.ts` as `uploadArtworkImage(client, adminClient, file, userId)`. All three actions use it.
