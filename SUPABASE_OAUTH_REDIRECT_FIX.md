# Fixing OAuth Redirect Issues

If you're getting redirected to localhost or seeing `{"error":"requested path is invalid"}`, you need to configure Supabase's redirect URLs correctly.

## Supabase Dashboard Configuration

1. Go to your Supabase Dashboard → **Authentication** → **URL Configuration**

2. **Site URL**: Set this to your Vercel domain (MUST include `https://` and NO trailing slash or leading spaces)
   ```
   https://provenance-khaki.vercel.app
   ```
   ⚠️ **Critical**: 
   - Must start with `https://` (no spaces before)
   - Must NOT have a trailing slash
   - Must NOT have leading or trailing spaces
   - Must match your production domain exactly
   - **Common mistake**: Copy-pasting can add invisible spaces - delete and retype if needed

3. **Redirect URLs**: Add both your Vercel and localhost URLs (one per line, exact match required):
   ```
   https://provenance-khaki.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
   ⚠️ **Important**: 
   - Each URL must be on a separate line
   - Must match EXACTLY what you pass in `redirectTo` parameter
   - Include the protocol (`https://` or `http://`)
   - No trailing slashes

## Google Cloud Console Configuration

1. Go to Google Cloud Console → **APIs & Services** → **Credentials**

2. Find your OAuth 2.0 Client ID

3. **Authorized redirect URIs**: Add your Supabase callback URL:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
   (This is the Supabase callback URL, NOT your app URL)

4. **Authorized JavaScript origins**: Add:
   ```
   https://your-project-id.supabase.co
   ```

## How It Works

1. User clicks "Sign in with Google" on your Vercel app
2. App redirects to Supabase OAuth endpoint with `redirectTo` parameter
3. Supabase redirects to Google OAuth
4. Google redirects back to Supabase callback (`https://your-project.supabase.co/auth/v1/callback`)
5. Supabase validates the `redirectTo` URL against allowed redirect URLs
6. If valid, Supabase redirects to your app's callback route (`/auth/callback`)
7. Your callback route then redirects to the home page using the request origin

## Troubleshooting

### Error: `{"error":"requested path is invalid"}`

If you see this error and the URL looks like:
```
https://your-project.supabase.co/your-domain.vercel.app?code=...
```

This means Supabase is treating your domain as a path. Fix it by:

1. **Check Site URL**: Must be exactly `https://provenance-khaki.vercel.app` (no trailing slash, with https://)
2. **Check Redirect URLs**: Must include exactly `https://provenance-khaki.vercel.app/auth/callback` (one per line, exact match)
3. **Clear browser cache** and try again
4. **Verify the redirectTo URL** in your code matches exactly what's in Redirect URLs

### Error: `{"code":500,"error_code":"unexpected_failure"}`

If you see this error after OAuth callback, check:

1. **Site URL has leading/trailing spaces**: 
   - Decode the JWT state parameter in the URL to see what Supabase received
   - If you see `"   https://..."` (with spaces), your Site URL has leading spaces
   - Delete the Site URL field completely and retype it (don't copy-paste)
   - Must be exactly: `https://provenance-khaki.vercel.app` (no spaces)

2. **Check Supabase Logs**:
   - Go to Supabase Dashboard → Logs → Postgres Logs or API Logs
   - Look for the exact error message around the time of the OAuth attempt

3. **Verify Redirect URLs**:
   - Each URL must be on its own line
   - No leading/trailing spaces
   - Exact match to what you pass in `redirectTo`

### Other Common Issues

- **Still redirecting to localhost?** Check that your Vercel domain is in Supabase's Redirect URLs list
- **Getting "redirect_uri_mismatch"?** Make sure the Supabase callback URL is in Google Cloud Console's Authorized redirect URIs
- **Session not persisting?** Make sure your Supabase environment variables are set correctly in Vercel

## Quick Checklist

Before testing OAuth, verify:

- [ ] Site URL: `https://provenance-khaki.vercel.app` (no trailing slash)
- [ ] Redirect URLs includes: `https://provenance-khaki.vercel.app/auth/callback`
- [ ] Redirect URLs includes: `http://localhost:3000/auth/callback` (for local dev)
- [ ] Google Cloud Console has: `https://upbiqtluqemrmonyghix.supabase.co/auth/v1/callback`
- [ ] All URLs match exactly (case-sensitive, no trailing slashes)

