# iPhone Artwork Upload: All Failure Points & Methods

This document lists **every place** the artwork upload flow can fail, especially on iPhone, and which code path handles it.

---

## Flow overview

1. **Client:** Add Artwork page → user selects files → `AddArtworkForm` builds `FormData` → `createArtworksBatch(formData, userId)` (Server Action).
2. **Server:** `create-artworks-batch.ts` validates FormData → ensures account → for each image: upload to storage → generate cert number → insert into `artworks`.

---

## 1. Client-side (add-artwork-form.tsx)

| # | Failure | Cause (especially on iPhone) | User sees | Code location |
|---|--------|------------------------------|-----------|----------------|
| 1.1 | No images in preview | `accept="image/*,.heic,.heif"` – some iOS versions or “Take Photo” use a type Safari doesn’t map to image/*; or `inferMimeType` returns non-image so file is filtered out | User picks photo but list stays empty | `handleFileSelect`: `inferMimeType(f).startsWith('image/')` |
| 1.2 | Submit with 0 images | User removed all or none selected | “Please upload at least one image” | `handleSubmit`: `imagePreviews.length === 0` |
| 1.3 | Missing title | One or more titles empty | “Please provide a title for all artworks” | `handleSubmit`: `missingTitles.length > 0` |
| 1.4 | **Network/Server Action throw** | Body too large (over 10MB after our fix), network error, server 5xx, or any uncaught exception in the action | Catch block: size-related message or “Something went wrong. If you're on a phone…” | `catch (e)` in `startTransition` |
| 1.5 | **Server returns result.error** | Any `return { error: '...' }` from `createArtworksBatch` | `setError(result.error)` | After `createArtworksBatch` |
| 1.6 | Success but no redirect | `result.artworkIds` empty and no `result.error` (shouldn’t happen) | No error; user stays on form | `else if (result.artworkIds && result.artworkIds.length > 0)` |

**iPhone-specific client notes:**

- **File type:** iOS can give `file.type === ''` or generic type for HEIC/photo library; we use `inferMimeType` so HEIC is still treated as image and not dropped.
- **Camera input:** `capture="environment"` and `accept="image/*"` can produce HEIC with no extension in `file.name`; we still add the file and use inferred type.
- **FormData:** Safari has historically sent empty file bodies for some inputs; we can’t fix that on client, but server now rejects `size === 0` and returns a clear error.

---

## 2. Next.js / network (before action runs)

| # | Failure | Cause | User sees | Mitigation |
|---|--------|--------|-----------|------------|
| 2.1 | **Request body > bodySizeLimit** | Total FormData size > 10MB (e.g. multiple large iPhone photos) | Catch block: “Photo(s) are too large…” (if message matches) or generic “Something went wrong…” | `next.config.ts`: `serverActions.bodySizeLimit: '10mb'` |
| 2.2 | Request timeout | Slow connection or server slow | Same as 1.4 | — |
| 2.3 | Network error / no response | Offline, DNS, TLS, etc. | Same as 1.4 | — |

---

## 3. Server action: create-artworks-batch.ts (entry & validation)

| # | Failure | Cause | Returned to client | Code location |
|---|--------|--------|--------------------|---------------|
| 3.1 | **No valid images** | All entries from `formData.getAll('images')` are missing, not File-like, or `file.size === 0` (iOS empty-file issue) | `{ error: 'No valid images received. If you're on a phone…' }` | Valid loop; `validImages.length === 0` |
| 3.2 | Title count mismatch | After filtering, `validTitles.length !== validImages.length` | `{ error: 'Each image must have a title' }` | After valid loop |
| 3.3 | **Account not found and create fails** | RLS or DB error on `accounts` select/insert | `{ error: 'Account not found. Please complete your profile setup first.' }` | Account lookup + insert |
| 3.4 | **Outer catch** | Any thrown error before/after the per-artwork loop (e.g. getSupabaseServerClient, unexpected throw) | `{ error: 'An unexpected error occurred' }` | Top-level catch |

---

## 4. Per-artwork loop: upload (uploadArtworkImage)

| # | Failure | Cause (iPhone-related) | Effect | Code location |
|---|--------|------------------------|--------|---------------|
| 4.1 | **Bucket create fails** | Bucket doesn’t exist; createBucket fails (e.g. allowedMimeTypes / permissions) | Throws → “An unexpected error occurred” | `adminClient.storage.createBucket` |
| 4.2 | **allowedMimeTypes** | Bucket already exists with a **fixed** list that doesn’t include HEIC | Upload fails with storage error | Supabase Storage (bucket config); we only set allowedMimeTypes when **creating** bucket, not updating |
| 4.3 | **file.arrayBuffer()** | On some runtimes, File from FormData might not be readable (rare) | Throws in upload | `const bytes = await file.arrayBuffer()` |
| 4.4 | **File size > bucket fileSizeLimit** | Bucket limit 10MB; iPhone photo slightly over | Storage returns error → “Upload failed: …” | `bucket.upload` |
| 4.5 | **Storage RLS** | Insert policy requires `split_part(name, '/', 1) = auth.uid()::text`; path uses `userId` – if for some reason JWT and userId differ, insert denied | Upload fails with permission error | Storage policy `artworks_storage_insert` |
| 4.6 | **Wrong content-type** | If we sent a MIME type the bucket doesn’t allow (e.g. HEIC not in list) | Storage rejects upload | `bucket.upload(..., { contentType })` |
| 4.7 | **file.name / extension** | Empty `file.name` → `extension = 'jpg'`; no problem. Non-image extension could map to a type not in allowedMimeTypes if we ever added exotic types | Possible storage error | `inferContentType`; `extension = file.name.split('.').pop() \|\| 'jpg'` |

Any upload throw is caught in the per-artwork try/catch → `errors.push(...)`; if all fail, we return `error: 'Failed to create artworks: …'`.

---

## 5. Per-artwork loop: certificate number (generateCertificateNumber)

| # | Failure | Cause | Effect | Code location |
|---|--------|--------|--------|---------------|
| 5.1 | **RPC not found or fails** | Migration not run or DB error | We fall back to client-side generation | `client.rpc('generate_certificate_number')` |
| 5.2 | **Fallback: can’t get unique in 10 attempts** | Extremely unlikely | Throws “Failed to generate unique certificate number” → per-artwork catch → in `errors` | `generateCertificateNumber` while loop |

---

## 6. Per-artwork loop: DB insert (artworks)

| # | Failure | Cause | Effect | Code location |
|---|--------|--------|--------|---------------|
| 6.1 | **RLS insert policy** | `account_id = auth.uid()` or gallery member; if session and `userId` mismatch, insert denied | `error` from Supabase → `errors.push('Failed to create artwork N: …')` | `client.from('artworks').insert(...)` |
| 6.2 | **Unique constraint** | Duplicate `certificate_number` (theoretical) | Same as 6.1 | Insert |
| 6.3 | **Other DB errors** | Not null, FK, etc. | Same as 6.1 | Insert |

---

## 7. Single-artwork path (create-artwork.ts) – not used by current form

The add form only uses **createArtworksBatch**. If anything ever called `createArtwork` (single) from mobile:

- **create-artwork.ts** does **not** use `inferContentType` and uses `file.type` only → HEIC can be sent as `''` and bucket may reject.
- Its bucket create uses **no HEIC** in `allowedMimeTypes` → HEIC would fail there too.

So for consistency and future-proofing, single-artwork should be aligned with batch (inferContentType + HEIC in allowedMimeTypes when creating bucket).

---

## 8. Quick reference: why an iPhone upload might still fail (verified)

Each row below is verified against the current code paths. **User sees** is what the user actually gets in the form’s error alert (or catch message).

| Reason | Where it happens | User sees / mitigation |
|--------|-------------------|-------------------------|
| **Request > 10MB** | Next.js (before action runs) | Next throws `"Body exceeded X MB limit"` → form catch matches `body.*limit\|exceeded` → **"Photo(s) are too large to upload. Try one image at a time or use smaller photos (under 10MB each)."** If the thrown error has a different message, user sees generic **"Something went wrong. If you're on a phone…"**. |
| **All files empty (Safari)** | Server validation | Server returns `{ error: '...' }` → **"No valid images received. If you're on a phone, try choosing smaller photos or one image at a time (max 10MB each)."** |
| **Bucket doesn’t allow HEIC** | Storage (bucket config) | Upload throws → per-artwork catch → `result.error` = **"Failed to create artworks: Error processing artwork N: Upload failed: …"** (user sees the full string including "Upload failed"). |
| **Storage RLS** | Storage insert (path ≠ auth.uid()) | Same as above: **"Failed to create artworks: … Upload failed: …"**. |
| **Network / timeout** | Client or server | Form catch (no size match) → **"Something went wrong. If you're on a phone, try one image at a time or smaller photos, then try again."** |
| **Account missing** | Server (accounts select/insert) | **"Account not found. Please complete your profile setup first."** |
| **Session expired** | RLS on storage or artworks | Storage: **"Failed to create artworks: … Upload failed: …"**. DB insert: **"Failed to create artwork N: &lt;postgres message&gt;"** (or "Failed to create artworks: …" if all fail). |
| **Partial success** (e.g. 2 of 3 fail) | Per-artwork upload or insert | **"Some certificates could not be created: … N succeeded — go to My Artworks to view them."** (User stays on add page; no redirect so they can read the message.) |

---

## 9. Summary: iPhone-specific reasons upload can fail

1. **Request body too large** (before fix: 1MB; now 10MB) – multiple large photos.
2. **All files arrive empty** (Safari FormData bug) → “No valid images received…”
3. **Bucket doesn’t allow HEIC** – bucket was created earlier without HEIC; we don’t update existing buckets.
4. **Storage RLS** – path prefix must equal `auth.uid()` (we use `userId`; normally same).
5. **Network/timeout** – slow or flaky connection.
6. **Account missing** – first-time user, account not created yet.
7. **Session/ auth** – user signed out mid-flow or session expired → RLS denies insert/storage.

---

## 10. Methods to improve robustness (done or recommended)

| Area | Change |
|------|--------|
| Config | ✅ `serverActions.bodySizeLimit: '10mb'` |
| Batch validation | ✅ Filter `size === 0` and invalid files; return clear error when no valid images |
| Batch upload | ✅ `inferContentType` so HEIC/empty type works; HEIC in allowedMimeTypes when **creating** bucket |
| Batch upload | Use **lowercase** extension in storage path so extension never conflicts with MIME (e.g. `.HEIC` → `.heic`) |
| Form catch | ✅ Detect size-related errors; suggest one image or smaller photos |
| Single-artwork | Align with batch: inferContentType + HEIC in bucket create (if that code path is ever used from mobile) |
| Bucket | If bucket already exists without HEIC, add a migration or dashboard step to update `allowedMimeTypes` to include HEIC/HEIF |

---

## 11. File reference

- **Form:** `apps/provenance/src/app/artworks/add/_components/add-artwork-form.tsx`
- **Batch action:** `apps/provenance/src/app/artworks/add/_actions/create-artworks-batch.ts`
- **Single action:** `apps/provenance/src/app/artworks/add/_actions/create-artwork.ts`
- **Page (userId):** `apps/provenance/src/app/artworks/add/page.tsx`
- **Config:** `apps/provenance/next.config.ts`
- **Storage RLS / bucket:** `apps/web/supabase/migrations/20250103000000_create_artworks.sql`
