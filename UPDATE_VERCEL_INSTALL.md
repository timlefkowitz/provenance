# Update Vercel Install Command

The lockfile has a mismatch with the overrides configuration. Update the install command to allow lockfile updates.

## Update Vercel Settings

Go to **Vercel Dashboard** → Settings → General → Build & Development Settings:

Change **Install Command** from:
```
pnpm install
```

To:
```
pnpm install --no-frozen-lockfile
```

This will allow pnpm to update the lockfile during installation to match the current package.json configuration.

## Why This Is Needed

After restructuring, the lockfile needs to be regenerated to match the new structure and the `pnpm.overrides` configuration in the root `package.json`.

## After First Successful Build

Once the build succeeds, you can change it back to `pnpm install` (with frozen lockfile) for faster builds, since the lockfile will be up to date.

