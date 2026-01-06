# Project Restructure Complete! 🎉

## What Changed

The app has been moved from `makerkit/nextjs-saas-starter-kit-lite/apps/provenance/` to the **repository root** for easier Vercel deployment.

## New Structure

```
provenance/
├── src/                    # App source code
├── public/                 # Public assets
├── package.json            # App dependencies
├── next.config.ts          # Next.js config
├── tsconfig.json           # TypeScript config
├── pnpm-workspace.yaml     # Workspace config
├── .gitignore             # Git ignore rules
└── makerkit/              # Workspace packages
    └── nextjs-saas-starter-kit-lite/
        └── packages/       # @kit/* packages
```

## Update Vercel Settings

Now that the app is at the root, Vercel settings are **much simpler**:

### Go to Vercel Dashboard → Settings → General:

| Setting | Value |
|---------|-------|
| **Root Directory** | Leave **blank** (or `.`) |
| **Framework Preset** | `Next.js` |
| **Build Command** | `pnpm build` |
| **Output Directory** | `.next` |
| **Install Command** | `pnpm install` |
| **Node.js Version** | `20.x` (or auto) |

That's it! No more complex paths! 🎉

## Local Development

To run locally:

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev
```

The workspace packages are still in `makerkit/nextjs-saas-starter-kit-lite/packages/` and will be linked automatically via pnpm workspaces.

## Next Steps

1. **Update Vercel settings** (see above)
2. **Test locally**: `pnpm install && pnpm dev`
3. **Commit and push** the restructure
4. **Redeploy on Vercel** - it should work now!

