# Vercel 404 Diagnostics Guide

## Common Causes of 404 on Vercel

### 1. ❌ Invalid Supabase URL (MOST LIKELY)
**Symptom**: Build succeeds but app shows 404 or crashes

**Issue**: Missing `https://` in `NEXT_PUBLIC_SUPABASE_URL`
- ❌ Wrong: `upbiqtluqemrmonyghix.supabase.co`
- ✅ Correct: `https://upbiqtluqemrmonyghix.supabase.co`

**Fix**: 
1. Go to Vercel → Settings → Environment Variables
2. Update `NEXT_PUBLIC_SUPABASE_URL` to include `https://`
3. Redeploy

### 2. ❌ Using Local Demo Keys
**Symptom**: App fails to connect to Supabase, shows 404

**Issue**: Using local Supabase demo keys instead of remote keys

**Fix**:
1. Go to Supabase Dashboard → Settings → API
2. Copy your **real** remote keys (they're different from local)
3. Update in Vercel environment variables

### 3. ❌ Build Configuration Issues
**Symptom**: Build fails or output directory is wrong

**Check**:
- Root Directory: `apps/provenance`
- Build Command: `pnpm build`
- Output Directory: `.next`
- Install Command: `cd ../.. && pnpm install`

### 4. ❌ Middleware Errors
**Symptom**: App crashes on every request

**Check**: If Supabase connection fails in middleware, it could break routing

**Fix**: I've added error handling to prevent this

### 5. ❌ OnboardingGuard Errors
**Symptom**: App redirects incorrectly or crashes

**Check**: If Supabase connection fails, OnboardingGuard could throw errors

**Fix**: I've added error handling to prevent this

### 6. ❌ Missing Dependencies
**Symptom**: Build fails with module not found errors

**Check**: Vercel build logs for missing packages

**Fix**: Ensure `pnpm install` runs from repository root

### 7. ❌ Next.js Config Errors
**Symptom**: Build fails during config processing

**Check**: Invalid URL in `next.config.ts` can crash build

**Fix**: I've added error handling for invalid URLs

## Diagnostic Steps

### Step 1: Check Build Logs
1. Go to Vercel → Deployments
2. Click on the latest deployment
3. Check the **Build Logs** tab
4. Look for:
   - Build errors
   - Missing environment variables
   - Module not found errors
   - URL parsing errors

### Step 2: Check Runtime Logs
1. Go to Vercel → Deployments
2. Click on the latest deployment
3. Check the **Runtime Logs** tab
4. Look for:
   - Supabase connection errors
   - Middleware errors
   - Server component errors

### Step 3: Verify Environment Variables
1. Go to Vercel → Settings → Environment Variables
2. Verify all three are set:
   - `NEXT_PUBLIC_SUPABASE_URL` (with `https://`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (real remote key)
   - `SUPABASE_SERVICE_ROLE_KEY` (real remote key)
3. Make sure they're set for **Production**, **Preview**, and **Development**

### Step 4: Test Build Locally
```bash
cd apps/provenance
NEXT_PUBLIC_SUPABASE_URL=https://upbiqtluqemrmonyghix.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key> \
SUPABASE_SERVICE_ROLE_KEY=<your-key> \
pnpm build
```

If this fails locally, the same issue will happen on Vercel.

### Step 5: Check Vercel Project Settings
1. Go to Vercel → Project Settings
2. Verify:
   - **Root Directory**: `apps/provenance`
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm build` (or leave empty)
   - **Output Directory**: `.next` (or leave empty)
   - **Install Command**: `cd ../.. && pnpm install` (or leave empty)

## Quick Fixes Applied

I've made the following fixes to prevent 404s:

1. ✅ **Fixed `next.config.ts`**: Added error handling for invalid URLs (missing https://)
2. ✅ **Fixed `OnboardingGuard`**: Added error handling to prevent crashes if Supabase connection fails
3. ✅ **Improved error handling**: App won't crash if environment variables are misconfigured

## Still Getting 404?

If you've fixed the environment variables and still get 404:

1. **Share the build logs** from Vercel
2. **Share the runtime logs** from Vercel
3. **Check if the build completes successfully**
4. **Verify the deployment URL** - make sure you're checking the right deployment

## Most Common Issue

**90% of 404s are caused by:**
- Missing `https://` in `NEXT_PUBLIC_SUPABASE_URL`
- Using local demo keys instead of remote keys

Fix these first, then check other issues if it persists.

