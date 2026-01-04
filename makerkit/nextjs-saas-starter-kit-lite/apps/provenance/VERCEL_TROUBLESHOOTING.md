# Vercel 404 Troubleshooting

If you're getting a 404 error on Vercel, check the following:

## 1. Verify Project Settings in Vercel Dashboard

Go to your Vercel project settings and verify:

- **Root Directory**: Should be set to `apps/provenance` (or leave empty if using vercel.json)
- **Framework Preset**: Next.js
- **Build Command**: Should be `pnpm build` (or leave empty for auto-detection)
- **Output Directory**: `.next` (default, can leave empty)
- **Install Command**: `pnpm install` (or leave empty for auto-detection)

## 2. Check Build Logs

In Vercel dashboard, go to the deployment and check:
- Are there any build errors?
- Did the build complete successfully?
- Are there any missing environment variables?

## 3. Environment Variables

Make sure all required environment variables are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Monorepo Installation

If dependencies aren't installing correctly, try:

1. In Vercel dashboard, set **Install Command** to: `cd ../.. && pnpm install`
2. This ensures dependencies are installed from the repository root

## 5. Alternative: Remove vercel.json

If the vercel.json is causing issues:

1. Delete or rename `vercel.json`
2. Configure everything manually in Vercel dashboard:
   - Root Directory: `apps/provenance`
   - Build Command: `pnpm build`
   - Install Command: `cd ../.. && pnpm install` (to install from root)

## 6. Check Next.js Configuration

Verify that `next.config.ts` is correct and doesn't have any production-only issues.

## 7. Check Routes

Make sure your routes are properly set up:
- `/` should have a `page.tsx` file
- Check that middleware isn't blocking routes incorrectly

## 8. Common Issues

- **404 on all routes**: Usually means the build output isn't being found or the root directory is wrong
- **404 on specific routes**: Check that the route files exist and are properly exported
- **Build succeeds but 404**: Check the output directory configuration

## Quick Fix

Try this in Vercel dashboard settings:
- Root Directory: `apps/provenance`
- Build Command: `pnpm build`
- Install Command: `cd ../.. && pnpm install && cd apps/provenance`
- Output Directory: `.next` (or leave empty)

