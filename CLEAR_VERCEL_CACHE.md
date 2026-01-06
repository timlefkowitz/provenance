# Clear Vercel Build Cache

The build error shows it's still referencing the old path `./apps/provenance/src/middleware.ts`, which means Vercel is using a cached build.

## Steps to Fix:

1. **Go to Vercel Dashboard** → Your Project → **Settings** → **General**
2. Scroll down to **Build & Development Settings**
3. Find **"Build Cache"** section
4. Click **"Clear Build Cache"** or **"Purge Cache"**
5. **Redeploy** your project

## Alternative: Force Fresh Build

1. Go to **Deployments** tab
2. Click the three dots (⋯) on your latest deployment
3. Click **"Redeploy"**
4. **Uncheck** "Use existing Build Cache"
5. Click **"Redeploy"**

This will force Vercel to rebuild everything from scratch with the new structure.

## Why This Happens

After restructuring, Vercel's build cache still has references to the old file paths. Clearing the cache forces it to rebuild with the new structure at the root.

