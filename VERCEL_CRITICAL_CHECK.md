# CRITICAL: Verify These Exact Settings

## The Problem
Build succeeds ✅, but 404 with no logs ❌. This means Vercel can't find your built files.

## EXACT Settings Required

Go to **Vercel Dashboard** → Your Project → **Settings** → **General** → **Build & Development Settings**

### Copy These EXACTLY:

| Field | EXACT Value (copy/paste) |
|-------|-------------------------|
| **Root Directory** | (leave completely blank - empty field) |
| **Framework Preset** | `Next.js` |
| **Build Command** | `pnpm build` |
| **Output Directory** | `.next` |
| **Install Command** | `pnpm install --no-frozen-lockfile` |
| **Node.js Version** | `20.x` |

### Critical Points:

1. **Root Directory**: Must be **completely blank/empty** - not `.` or anything else
2. **Output Directory**: Must be exactly `.next` - no slashes, no paths, just `.next`
3. **Build Command**: Just `pnpm build` - no `cd` commands

## After Updating:

1. **Save** the settings
2. Go to **Deployments** tab
3. Click **"Redeploy"** on the latest deployment
4. **Uncheck** "Use existing Build Cache"
5. Click **"Redeploy"**

## Test After Deployment:

Try visiting:
- `https://provenance-khaki.vercel.app/test` (simple test page - should work)
- `https://provenance-khaki.vercel.app/` (homepage)

If `/test` works but `/` doesn't, it's a routing/middleware issue.
If both 404, the Output Directory is still wrong.

## Still Not Working?

If you've verified all settings are correct and it still 404s:

1. **Check Deployment Status**: Is it "Ready" (green) or "Error" (red)?
2. **Check Functions Tab**: Are there any serverless functions listed?
3. **Try a different domain**: Check if there are other assigned domains

