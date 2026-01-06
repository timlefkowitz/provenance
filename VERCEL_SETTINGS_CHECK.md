# Vercel Settings Verification

## Current Issue
Build succeeds, but visiting `provenance-khaki.vercel.app` returns 404 with no logs.

## Verify These Settings in Vercel Dashboard

Go to **Vercel Dashboard** → Your Project → **Settings** → **General**:

### Build & Development Settings

| Setting | Should Be | Current Value? |
|---------|-----------|----------------|
| **Root Directory** | Leave **blank** (or `.`) | ? |
| **Framework Preset** | `Next.js` | ? |
| **Build Command** | `pnpm build` | ? |
| **Output Directory** | `.next` | ? |
| **Install Command** | `pnpm install --no-frozen-lockfile` | ? |
| **Node.js Version** | `20.x` (or auto) | ? |

### Critical: Output Directory

The **Output Directory** MUST be exactly `.next` (not `apps/provenance/.next` or anything else).

## Check Deployment

1. Go to **Deployments** tab
2. Click on the latest deployment (should show "Ready" with green checkmark)
3. Look at the **"Functions"** section - are there any functions listed?
4. Check the **"Logs"** tab - any errors there?

## Test Deployment

Try visiting these URLs:
- `https://provenance-khaki.vercel.app/` (root)
- `https://provenance-khaki.vercel.app/api/health` (if you have a health endpoint)
- `https://provenance-khaki.vercel.app/_next/static/` (should show Next.js static files)

## If Still 404

1. **Check if deployment is actually live**: Look at the deployment status - is it "Ready" or "Error"?
2. **Check domain settings**: Go to Settings → Domains - is `provenance-khaki.vercel.app` assigned?
3. **Try redeploying**: Create a new deployment from the latest commit

## Quick Fix to Try

If Output Directory is wrong, update it to `.next` and redeploy.

