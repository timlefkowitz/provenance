# Fix OAuth Redirect Issue - Redirecting to Root Instead of /auth/callback

## Problem
After signing in with Google OAuth, you're being redirected to:
```
https://provenance.guru/?code=...
```
Instead of:
```
https://provenance.guru/auth/callback?code=...
```

This means Supabase is using the Site URL as a fallback instead of the redirectTo URL.

## Root Cause
Supabase redirects to the Site URL when:
1. The `redirectTo` URL doesn't exactly match what's in the Redirect URLs list
2. The Site URL is set incorrectly
3. There are invisible characters (spaces, trailing slashes) in the configuration

## Fix Steps

### Step 1: Update Supabase Site URL

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. **Delete** the current Site URL completely (select all and delete)
5. **Retype** (don't copy-paste) exactly:
   ```
   https://provenance.guru
   ```
   ⚠️ **Critical**:
   - Must start with `https://` (no spaces before)
   - Must NOT have a trailing slash
   - Must NOT have leading or trailing spaces
   - Type it manually to avoid invisible characters

### Step 2: Update Redirect URLs

In the same **URL Configuration** section:

1. **Delete all existing Redirect URLs**
2. **Add these URLs one by one** (one per line, type manually):
   ```
   https://provenance.guru/auth/callback
   http://localhost:3000/auth/callback
   ```
   ⚠️ **Important**:
   - Each URL must be on a separate line
   - Type them manually (don't copy-paste)
   - No trailing slashes
   - No leading/trailing spaces
   - Must match EXACTLY: `https://provenance.guru/auth/callback`

3. If you have a `www` subdomain configured, also add:
   ```
   https://www.provenance.guru/auth/callback
   ```

### Step 3: Verify Your Code is Sending the Correct URL

The code should be sending `https://provenance.guru/auth/callback` as the `redirectTo` parameter.

Your code in `src/components/google-sign-in-button.tsx` constructs it as:
```typescript
const origin = window.location.origin; // Should be https://provenance.guru
const redirectPath = pathsConfig.auth.callback; // Should be /auth/callback
const redirectTo = `${origin}${redirectPath}`; // Should be https://provenance.guru/auth/callback
```

This should be correct, but verify:
- When you visit `https://provenance.guru`, `window.location.origin` should be `https://provenance.guru`
- `pathsConfig.auth.callback` should be `/auth/callback`

### Step 4: Clear Browser Cache

After updating Supabase settings:
1. Clear your browser cache
2. Or use an incognito/private window
3. Try signing in with Google again

### Step 5: Check Supabase Logs

If it still doesn't work:
1. Go to Supabase Dashboard → **Logs** → **API Logs**
2. Look for errors around the time of your OAuth attempt
3. Check for messages about invalid redirect URLs

## Verification Checklist

Before testing, verify:

- [ ] Site URL: `https://provenance.guru` (no trailing slash, typed manually)
- [ ] Redirect URLs includes: `https://provenance.guru/auth/callback` (exact match, no trailing slash)
- [ ] Redirect URLs includes: `http://localhost:3000/auth/callback` (for local dev)
- [ ] No invisible spaces in either field
- [ ] Browser cache cleared
- [ ] Code constructs `redirectTo` as `https://provenance.guru/auth/callback`

## Why This Happens

When Supabase receives an OAuth callback from Google:
1. It validates the `redirectTo` parameter against the Redirect URLs list
2. If it doesn't find an exact match, it falls back to the Site URL
3. It appends the code parameter to the Site URL, resulting in `/?code=...`

The exact match requirement is very strict - even a trailing slash or space will cause a mismatch.

## Additional Notes

- The error "Server can't find the server" might be a DNS issue or the route handler not being hit
- Once the redirect goes to `/auth/callback`, the route handler at `src/app/auth/callback/route.ts` should process it
- Make sure your domain DNS is fully propagated and working
