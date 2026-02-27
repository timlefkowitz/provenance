# RLS Policies: Posting as Collector, Artist & Gallery

This document summarizes Row Level Security (RLS) for **posting** content (artworks, profiles, exhibitions, open calls) by role. Roles are stored in `user_profiles.role` (`collector`, `artist`, `gallery`). RLS itself is **account/profile based**, not role-name based: who can do what is determined by `auth.uid()`, `account_id`, and `gallery_profile_id`/`gallery_members`, not by checking the user’s role string.

---

## 1. Artworks (certificates / posting artworks)

**Table:** `public.artworks`  
**Key columns:** `account_id`, `gallery_profile_id`, `status`, `is_public`

### INSERT (post artwork)

- **Collector / Artist (personal)**  
  - Post as yourself: `account_id = auth.uid()`.  
  - No check on `user_profiles.role`; any authenticated user can insert with their own `account_id`.
- **Gallery**  
  - Post on behalf of a gallery: set `gallery_profile_id` to the gallery’s `user_profiles.id` and ensure the current user is a **member** of that gallery:
    - `account_id = auth.uid()` **or**
    - `gallery_profile_id is not null` and `exists (select 1 from gallery_members gm where gm.gallery_profile_id = artworks.gallery_profile_id and gm.user_id = auth.uid())`

**Policies (from migrations):**

- `artworks_insert`: authenticated; `with check`: `account_id = auth.uid()` **or** (`gallery_profile_id is not null` and user is in `gallery_members` for that `gallery_profile_id`).

### SELECT

- **Public:** `status = 'verified'` and `is_public = true` (anon + authenticated).
- **Own / gallery member:** `account_id = auth.uid()` or `is_gallery_member_for_artwork(account_id, gallery_profile_id)` (authenticated).

### UPDATE / DELETE

- Same as insert conceptually: owner by `account_id` or gallery member via `is_gallery_member_for_artwork(account_id, gallery_profile_id)`.

**Summary:** Collectors and artists post with `account_id = auth.uid()`. Galleries post with `gallery_profile_id` set and membership in `gallery_members`; RLS does not restrict by role label.

---

## 2. User profiles (collector / artist / gallery profiles)

**Table:** `public.user_profiles`  
**Columns:** `user_id`, `role` (`collector` | `artist` | `gallery`), name, bio, etc.

### INSERT (create profile)

- **Any authenticated user** can create a profile for themselves: `user_id = auth.uid()`.
- No restriction on `role`: a user can create collector, artist, and gallery profiles (subject to `unique(user_id, role)`).

**Policy:** `user_profiles_insert_own` — `with check`: `user_id = auth.uid()`.

### UPDATE

- **Owner:** `user_id = auth.uid()`.
- **Gallery profile only:** or the user is a **gallery member** for that profile:  
  `exists (select 1 from gallery_members gm where gm.gallery_profile_id = user_profiles.id and gm.user_id = auth.uid() and user_profiles.role = 'gallery')`.

**Policy:** `user_profiles_update_own` — `using` / `with check`: owner or gallery member (for gallery profiles).

### SELECT

- Own profiles: `user_id = auth.uid()`.
- Public: `is_active = true` (anon + authenticated).

**Summary:** Posting/updating **profiles** is allowed for the owner (any role) and for gallery members when the profile is a gallery profile. Creating a profile is allowed for any authenticated user for themselves; RLS does not restrict which role you can create.

---

## 3. Exhibitions (gallery-only)

**Table:** `public.exhibitions`  
**Key column:** `gallery_id` (references `accounts.id`).

### INSERT / UPDATE / DELETE

- **Gallery account owner:** `gallery_id = auth.uid()`.
- **Gallery member:** `is_gallery_member_for_exhibition(gallery_id)` (checks `gallery_members` + `user_profiles.role = 'gallery'`).

Only galleries (users who own or are members of the gallery account) can post/manage exhibitions; there is no RLS path for collectors or artists to create exhibitions.

---

## 4. Open calls (gallery-only)

**Table:** `public.open_calls`  
**Key column:** `gallery_profile_id`.

### INSERT / UPDATE / DELETE

- **Gallery owner or admin only:** `is_gallery_owner_or_admin(gallery_profile_id)`.

**Policy names:** `open_calls_insert_gallery`, `open_calls_update_gallery`, `open_calls_delete_gallery`.

Only gallery owners/admins can create/update/delete open calls; collectors and artists cannot.

---

## 5. Open call submissions (anyone can submit)

**Table:** `public.open_call_submissions`

### INSERT

- **Authenticated or anon:** `with check (true)` — artists/collectors (or anon) submit to open calls; no role check.

### SELECT

- **Gallery:** can read submissions for their open calls (`is_gallery_owner_or_admin(oc.gallery_profile_id)`).
- **Submitter:** `account_id = auth.uid()`.

---

## 6. Helper functions used by RLS

- **`is_gallery_member_for_artwork(artwork_account_id, artwork_gallery_profile_id)`**  
  Returns true if the current user is the account owner or a member of the gallery (via `gallery_members` / `user_profiles.role = 'gallery'`).
- **`is_gallery_member_for_exhibition(exhibition_gallery_id)`**  
  Returns true if the current user owns the gallery account or is a gallery member for that account.
- **`is_gallery_owner_or_admin(gallery_profile_id)`**  
  (From migration `20250131000001_grant_is_gallery_owner_or_admin`) — used for open calls and similar gallery-admin actions.

---

## 7. Quick reference: who can post what

| Content type       | Collector | Artist | Gallery |
|--------------------|-----------|--------|---------|
| **Artworks**       | Yes (own `account_id`) | Yes (own `account_id`) | Yes (with `gallery_profile_id` + gallery membership) |
| **User profiles**  | Create/update own      | Create/update own      | Create/update own; gallery members can update gallery profile |
| **Exhibitions**    | No                    | No                    | Yes (owner or member) |
| **Open calls**     | No                    | No                    | Yes (owner/admin only) |
| **Open call submissions** | Yes (submit)   | Yes (submit)           | Yes (submit); can also read/manage their calls’ submissions |

---

## 8. Where policies live (migrations)

- **Artworks:** `20250103000000_create_artworks.sql`, `20250126000001_update_rls_for_gallery_members.sql`, `20250126000003_fix_authenticated_public_artworks.sql`
- **User profiles:** `20250113000000_add_user_profiles.sql`, `20250126000001_update_rls_for_gallery_members.sql`
- **Exhibitions / exhibition_artists / exhibition_artworks:** `20250112000000_add_exhibitions.sql`, `20250126000001_update_rls_for_gallery_members.sql`
- **Open calls:** `20250210000000_add_open_calls.sql`
- **Gallery helpers:** `20250131000000_fix_gallery_members_rls_recursion.sql`, `20250131000001_grant_is_gallery_owner_or_admin.sql`

To inspect current policies in the DB, use the queries in `CHECK_RLS_STATUS.sql` (artworks) and extend similarly for `user_profiles`, `exhibitions`, and `open_calls` if needed.
