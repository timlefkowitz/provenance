# Environment Variables Explained

## How Environment Variables Work

You **cannot** have two variables with the same name in the same file. Instead, you use **different files** or **different systems** for different environments.

## Current Setup (Correct ✅)

### Local Development (`.env.local`)
Your `.env.local` file should have **local** Supabase settings:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

✅ **This is correct for local development!**

### Production (Vercel Dashboard)
For production, you set environment variables **in Vercel**, NOT in a file:

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add these with your **remote** Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://upbiqtluqemrmonyghix.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-remote-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-remote-service-role-key>
   ```

## How It Works

- **Local**: Next.js reads from `.env.local` → uses local Supabase
- **Vercel**: Next.js reads from Vercel's environment variables → uses remote Supabase
- They never conflict because they're in different places!

## Important Notes

1. **`.env.local` is gitignored** - it never gets deployed to Vercel
2. **Vercel uses its own environment variables** - set in the dashboard
3. **You don't need a production env file** - Vercel handles it

## If You Want to Test Production Locally

You can create a `.env.production.local` file (also gitignored):
```env
NEXT_PUBLIC_SUPABASE_URL=https://upbiqtluqemrmonyghix.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-remote-key>
SUPABASE_SERVICE_ROLE_KEY=<your-remote-key>
```

Then run:
```bash
NODE_ENV=production pnpm build
```

But for normal development, just use `.env.local` with local settings.

## Summary

- ✅ Keep `.env.local` with local Supabase (what you have)
- ✅ Set remote Supabase in Vercel dashboard (not in a file)
- ✅ They work automatically based on where the app runs

