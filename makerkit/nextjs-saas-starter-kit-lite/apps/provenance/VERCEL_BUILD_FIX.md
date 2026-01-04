# Fix for Vercel Build Error

## The Problem

The error shows:
```
ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND  No package.json (or package.yaml, or package.json5) was found in "/vercel/path0".
```

This happens because:
1. Vercel clones your repo to `/vercel/path0` (repo root)
2. The monorepo root is at `makerkit/nextjs-saas-starter-kit-lite/` (has package.json)
3. The app is at `makerkit/nextjs-saas-starter-kit-lite/apps/provenance/`
4. The install command `cd ../.. && pnpm install` is going to the wrong directory

## The Fix

I've updated `vercel.json` to:

```json
{
  "buildCommand": "cd apps/provenance && pnpm build",
  "outputDirectory": "apps/provenance/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "rootDirectory": "makerkit/nextjs-saas-starter-kit-lite"
}
```

### What Changed

1. **rootDirectory**: Changed to `makerkit/nextjs-saas-starter-kit-lite` (monorepo root)
   - This is where `package.json` and `pnpm-workspace.yaml` are located
   - Vercel will change to this directory first

2. **installCommand**: Changed to just `pnpm install`
   - Since rootDirectory is now the monorepo root, we can run `pnpm install` directly
   - No need to `cd` anywhere

3. **buildCommand**: Changed to `cd apps/provenance && pnpm build`
   - From the monorepo root, we need to go into the app directory to build

4. **outputDirectory**: Changed to `apps/provenance/.next`
   - Relative to the rootDirectory (monorepo root)

## How It Works Now

1. Vercel clones repo to `/vercel/path0`
2. Changes to rootDirectory: `/vercel/path0/makerkit/nextjs-saas-starter-kit-lite/` (monorepo root)
3. Runs `pnpm install` → installs all workspace dependencies
4. Runs `cd apps/provenance && pnpm build` → builds the Next.js app
5. Finds output in `apps/provenance/.next`

## Alternative: Manual Configuration

If `vercel.json` still doesn't work, configure manually in Vercel dashboard:

- **Root Directory**: `makerkit/nextjs-saas-starter-kit-lite`
- **Build Command**: `cd apps/provenance && pnpm build`
- **Output Directory**: `apps/provenance/.next`
- **Install Command**: `pnpm install`
- **Framework**: Next.js

## Test It

After updating, push the changes and redeploy. The build should now:
1. ✅ Find package.json in the monorepo root
2. ✅ Install all workspace dependencies
3. ✅ Build the Next.js app
4. ✅ Deploy successfully

