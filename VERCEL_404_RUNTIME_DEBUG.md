# Debugging Vercel 404 After Successful Build

## Build Status: ✅ SUCCESS
The build completes successfully and all routes are generated. The 404 is a **runtime issue**, not a build issue.

## Quick Checks

### 1. What URL are you visiting?
- Are you visiting the root domain? (e.g., `https://provenance-khaki.vercel.app`)
- Or a specific path? (e.g., `https://provenance-khaki.vercel.app/artworks`)

### 2. Check Vercel Function Logs
1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Click on the latest deployment
3. Click **"Functions"** tab
4. Look for any errors or logs

### 3. Verify Environment Variables
Go to **Vercel Dashboard** → Settings → Environment Variables and verify:

| Variable | Should Be |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://upbiqtluqemrmonyghix.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key (long JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service_role key (long JWT) |

**Important**: Make sure `NEXT_PUBLIC_SUPABASE_URL` has `https://` at the beginning!

### 4. Check Browser Console
Open your browser's Developer Tools (F12) and check:
- **Console tab**: Any JavaScript errors?
- **Network tab**: Are requests failing? What status codes?

### 5. Test Specific Routes
Try visiting these URLs directly:
- `https://your-domain.vercel.app/` (homepage)
- `https://your-domain.vercel.app/artworks` (artworks feed)
- `https://your-domain.vercel.app/auth/sign-in` (sign in page)

## Common Causes

1. **Missing Environment Variables**: Supabase keys not set or incorrect
2. **Supabase Connection Failing**: Invalid URL or keys
3. **Middleware Error**: Check Vercel function logs
4. **OnboardingGuard Redirect**: If you're signed in but haven't completed onboarding, it redirects to `/onboarding`

## Next Steps

1. **Check Vercel Function Logs** - This will show the actual error
2. **Verify Environment Variables** - Make sure all three Supabase vars are set correctly
3. **Try visiting `/auth/sign-in`** - This should work even without Supabase configured
4. **Check the deployment URL** - Make sure you're visiting the correct domain

Let me know what you find in the function logs!

