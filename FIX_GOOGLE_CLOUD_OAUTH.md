# Fix Google Cloud Console OAuth Configuration

## Current Issues

### Issue 1: Authorized JavaScript Origins Missing
**Current:**
- ✅ `https://provenance-khaki.vercel.app` (old domain)

**Missing:**
- ❌ `https://provenance.guru` (new domain)
- ❌ `https://upbiqtluqemrmonyghix.supabase.co` (Supabase)

### Issue 2: Wrong Redirect URI
**Current Authorized Redirect URIs:**
- ✅ `https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback` (CORRECT - this is what Google should redirect to)
- ❌ `https://provenance.guru/auth/callback` (WRONG - Google should NOT redirect directly to your app)
- ⚠️ `https://provenance-khaki.vercel.app/auth/callback` (old domain - can remove)
- ✅ `http://localhost:3000/auth/callback` (local dev - keep for testing)

**Why it's wrong:**
- Google OAuth redirects to **Supabase**, not directly to your app
- Supabase then redirects to your app
- Having `https://provenance.guru/auth/callback` in Google Cloud will cause errors

## Fix Steps

### Step 1: Update Authorized JavaScript Origins

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Find **Authorized JavaScript origins**
5. Click **+ ADD URI** and add:
   ```
   https://provenance.guru
   ```
6. Click **+ ADD URI** and add:
   ```
   https://upbiqtluqemrmonyghix.supabase.co
   ```
7. **Keep** `https://provenance-khaki.vercel.app` (or remove if you're not using it anymore)

**Final Authorized JavaScript Origins should have:**
- `https://provenance.guru` (new domain)
- `https://upbiqtluqemrmonyghix.supabase.co` (Supabase)
- `https://provenance-khaki.vercel.app` (old domain - optional, can remove)

### Step 2: Fix Authorized Redirect URIs

1. In the same OAuth client configuration, find **Authorized redirect URIs**
2. **REMOVE** this URI (it's wrong):
   - ❌ `https://provenance.guru/auth/callback`
3. **KEEP** these URIs:
   - ✅ `https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback` (REQUIRED - this is correct)
   - ✅ `http://localhost:3000/auth/callback` (for local dev)
4. **OPTIONAL**: Remove old Vercel domain if not using:
   - `https://provenance-khaki.vercel.app/auth/callback` (can remove)

**Final Authorized Redirect URIs should have:**
- ✅ `https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback` (REQUIRED)
- ✅ `http://localhost:3000/auth/callback` (for local dev)
- ❌ **NOT** `https://provenance.guru/auth/callback` (remove this!)

### Step 3: Save Changes

1. Click **Save** at the bottom
2. Wait 1-2 minutes for changes to propagate

## Why This Configuration is Correct

### How OAuth Flow Works:

1. User clicks "Sign in with Google" on `https://provenance.guru`
2. App redirects to Supabase OAuth endpoint
3. Supabase redirects to Google OAuth (using Google Client ID)
4. **Google redirects back to Supabase**: `https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback`
5. Supabase processes the OAuth callback
6. Supabase validates the `redirectTo` parameter (`https://provenance.guru/auth/callback`)
7. **Supabase redirects to your app**: `https://provenance.guru/auth/callback?code=...`
8. Your app processes the callback

**Key Point**: Google never redirects directly to your app. It always goes through Supabase first.

## Correct Configuration Summary

### Authorized JavaScript Origins:
```
https://provenance.guru
https://upbiqtluqemrmonyghix.supabase.co
https://provenance-khaki.vercel.app (optional - old domain)
```

### Authorized Redirect URIs:
```
https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

**Do NOT include:**
- ❌ `https://provenance.guru/auth/callback` (Google doesn't redirect here)
- ❌ `https://provenance-khaki.vercel.app/auth/callback` (old domain, can remove)

## Verification Checklist

After making changes:

- [ ] Authorized JavaScript Origins includes: `https://provenance.guru`
- [ ] Authorized JavaScript Origins includes: `https://upbiqtluqemrmonyghix.supabase.co`
- [ ] Authorized Redirect URIs includes: `https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback`
- [ ] Authorized Redirect URIs does NOT include: `https://provenance.guru/auth/callback`
- [ ] Changes saved
- [ ] Waited 1-2 minutes for propagation

## After Fixing

1. **Clear browser cache** or use incognito window
2. **Test Google sign-in** on `https://provenance.guru`
3. Should work correctly now!

## Common Errors After Fix

**If you get "redirect_uri_mismatch":**
- Make sure `https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback` is in Authorized Redirect URIs
- Wait 1-2 minutes after saving (Google needs time to update)

**If you get "origin_mismatch":**
- Make sure `https://provenance.guru` is in Authorized JavaScript Origins
- Make sure `https://upbiqtluqemrmonyghix.supabase.co` is in Authorized JavaScript Origins
