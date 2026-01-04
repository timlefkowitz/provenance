# Vercel Build Settings

## Recommended Settings for Your Project

### Option 1: Using vercel.json (Automatic)

If you have `vercel.json` in your repository root, Vercel will automatically use these settings:

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "cd ../.. && pnpm install",
  "framework": "nextjs",
  "rootDirectory": "apps/provenance"
}
```

**No manual configuration needed** - Vercel will detect and use these automatically.

### Option 2: Manual Configuration in Vercel Dashboard

If you prefer to configure manually (or if vercel.json isn't working):

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **General**

2. Set the following:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `apps/provenance` |
   | **Framework Preset** | Next.js |
   | **Build Command** | `pnpm build` |
   | **Output Directory** | `.next` |
   | **Install Command** | `cd ../.. && pnpm install` |
   | **Node.js Version** | 18.x or 20.x (auto-detected) |

## Important Notes

### Root Directory
- **Must be**: `apps/provenance`
- This tells Vercel where your Next.js app is located in the monorepo

### Install Command
- **Must be**: `cd ../.. && pnpm install`
- This ensures dependencies are installed from the repository root
- This is critical for workspace packages to work correctly

### Build Command
- **Should be**: `pnpm build`
- This runs from the `apps/provenance` directory (after rootDirectory is set)
- The build script in `package.json` is `next build`

### Output Directory
- **Should be**: `.next`
- This is the default Next.js output directory
- Vercel will find it automatically if rootDirectory is set correctly

## Verification

After setting these, your deployment should:
1. ✅ Install dependencies from repo root
2. ✅ Change to `apps/provenance` directory
3. ✅ Run `pnpm build`
4. ✅ Find output in `.next` directory
5. ✅ Deploy successfully

## Troubleshooting

### If Build Fails

1. **Check Build Logs**:
   - Go to Deployments → Click on failed deployment
   - Look for errors in the build logs

2. **Common Issues**:
   - **"Module not found"**: Install command not running from root
   - **"Command not found: pnpm"**: Vercel should auto-detect pnpm, but verify
   - **"Cannot find module"**: Workspace packages not installing correctly

3. **Try This**:
   - Remove `vercel.json` and configure manually
   - Or update `vercel.json` with the exact settings above

### If 404 After Successful Build

1. Check environment variables are set correctly
2. Verify root directory is `apps/provenance`
3. Check output directory is `.next`
4. Review runtime logs for errors

## Current Configuration

Your `vercel.json` currently has:
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "cd ../.. && pnpm install",
  "framework": "nextjs",
  "rootDirectory": "apps/provenance"
}
```

This should work! If it doesn't, try the manual configuration above.

