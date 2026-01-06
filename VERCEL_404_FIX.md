# Fixing Vercel 404 After Successful Build

## The Problem
Build completes successfully, all routes are generated, but Vercel returns 404.

## Solution: Verify Output Directory

The Output Directory path must be **exactly correct** relative to the Root Directory.

### Current Settings Should Be:

| Setting | Value |
|---------|-------|
| **Root Directory** | `makerkit/nextjs-saas-starter-kit-lite` |
| **Output Directory** | `apps/provenance/.next` |
| **Build Command** | `cd apps/provenance && pnpm build` |

### How to Verify:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **General**
2. Scroll to **Build & Development Settings**
3. **Double-check** the Output Directory is exactly: `apps/provenance/.next`
   - No leading slash
   - No trailing slash
   - Relative to Root Directory

### Alternative: Try Absolute Path

If relative path doesn't work, try setting Output Directory to:
```
makerkit/nextjs-saas-starter-kit-lite/apps/provenance/.next
```

(But this usually doesn't work - relative is better)

### Debug Steps:

1. **Check Build Logs**: Look for "Deploying outputs..." - does it show any errors?
2. **Check Deployment**: In Vercel Dashboard → Deployments → Click on the deployment → Check "Functions" tab - are routes listed?
3. **Try Visiting**: `https://your-domain.vercel.app/artworks` - does it work?
4. **Check Root**: Visit `https://your-domain.vercel.app/` - does the homepage work?

### If Still Not Working:

The issue might be that Vercel needs the Output Directory to be just `.next` if we set Root Directory to `apps/provenance` instead.

Try this alternative configuration:

| Setting | Value |
|---------|-------|
| **Root Directory** | `makerkit/nextjs-saas-starter-kit-lite/apps/provenance` |
| **Output Directory** | `.next` |
| **Build Command** | `pnpm build` |
| **Install Command** | `cd ../.. && pnpm install` |

This sets the root to the app directory, so `.next` is directly inside it.

