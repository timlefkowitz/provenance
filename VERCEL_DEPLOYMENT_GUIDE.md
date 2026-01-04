# Vercel Deployment Guide

## Quick Fix for Build Errors

If you're getting `ERR_PNPM_META_FETCH_FAIL` or `ERR_INVALID_THIS` errors:

### 1. Set Node.js Version to 20.x (MOST IMPORTANT)

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **General**
2. Find "Build & Development Settings"
3. Set **Node.js Version** to `20.x`
4. Click **Save**

This fixes pnpm 10.x compatibility issues.

### 2. Update Install Command (if needed)

If the error persists after setting Node.js to 20.x, update the Install Command:

```bash
cd makerkit/nextjs-saas-starter-kit-lite && npm install -g pnpm@10.19.0 && pnpm install --no-frozen-lockfile
```

### 3. Alternative: Use npm (Most Reliable)

If pnpm continues to fail, use npm instead:

| Setting | Value |
|---------|-------|
| **Node.js Version** | `20.x` |
| **Install Command** | `cd makerkit/nextjs-saas-starter-kit-lite && npm install --legacy-peer-deps` |
| **Build Command** | `cd makerkit/nextjs-saas-starter-kit-lite/apps/provenance && npm run build` |
| **Output Directory** | `makerkit/nextjs-saas-starter-kit-lite/apps/provenance/.next` |

### 4. Clear Cache and Redeploy

1. Go to Settings → General → Clear Build Cache
2. Go to Deployments tab
3. Click the three dots (⋯) on latest deployment
4. Click **Redeploy** (make sure "Use existing cache" is unchecked)

## Full Configuration

### Required Vercel Settings

| Setting | Value |
|---------|-------|
| **Node.js Version** | `20.x` |
| **Root Directory** | Leave blank or `.` |
| **Build Command** | `cd makerkit/nextjs-saas-starter-kit-lite/apps/provenance && pnpm build` |
| **Output Directory** | `makerkit/nextjs-saas-starter-kit-lite/apps/provenance/.next` |
| **Install Command** | `cd makerkit/nextjs-saas-starter-kit-lite && pnpm install` |

### Required Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

1. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key (from Supabase Dashboard → Project Settings → API)
3. `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (keep secret!)

**Important**: These must be your **production Supabase keys**, not local keys. Get them from:
- Supabase Dashboard → Your Project → Settings → API

## Troubleshooting

### Dashboard Settings Override vercel.json

If `vercel.json` changes don't work, it's because dashboard settings override the file. Always configure in the dashboard.

### Build Still Failing After Setting Node.js to 20.x?

1. Verify the Node.js version in build logs shows `20.x`
2. Clear build cache completely
3. Try using npm instead of pnpm
4. Check if npm registry is having issues at https://status.npmjs.org

### 404 Error After Successful Build

This means environment variables are wrong:
1. Check `NEXT_PUBLIC_SUPABASE_URL` includes `https://`
2. Verify you're using production keys, not local demo keys
3. Ensure keys match your Supabase project

## Why These Errors Happen

- `ERR_PNPM_META_FETCH_FAIL` / `ERR_INVALID_THIS`: pnpm 10.x has compatibility issues with Node.js 18.x. Use Node.js 20.x.
- Lockfile warnings: pnpm lockfile format changed in v10. The `--no-frozen-lockfile` flag handles this.
- Dashboard overrides: Vercel dashboard settings always override `vercel.json` when set manually.

## Success Indicators

Your deployment should succeed when you see:
- ✅ Node.js version: 20.x in logs
- ✅ Packages install without ERR_INVALID_THIS errors
- ✅ Build completes successfully
- ✅ App loads without 404 errors

