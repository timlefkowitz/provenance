# Vercel Environment Variables Checklist

## ✅ Quick Fix Checklist

### 1. Fix the Supabase URL
- [ ] Add `https://` prefix
- [ ] Should be: `https://upbiqtluqemrmonyghix.supabase.co`
- [ ] NOT: `upbiqtluqemrmonyghix.supabase.co` (missing https://)

### 2. Get Real Remote Keys
- [ ] Go to Supabase Dashboard → Settings → API
- [ ] Copy **anon public** key (NOT the local demo key)
- [ ] Copy **service_role secret** key (NOT the local demo key)
- [ ] Keys should be long JWT tokens (200+ chars) starting with `eyJ...`

### 3. Update Vercel
- [ ] Go to Vercel → Project Settings → Environment Variables
- [ ] Update `NEXT_PUBLIC_SUPABASE_URL` with `https://` prefix
- [ ] Replace `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your real remote key
- [ ] Replace `SUPABASE_SERVICE_ROLE_KEY` with your real remote key
- [ ] Set for Production, Preview, AND Development environments

### 4. Redeploy
- [ ] Redeploy your project in Vercel
- [ ] Check build logs for errors
- [ ] Test the deployed site

## Current vs Correct

### ❌ What You Have (WRONG)
```
NEXT_PUBLIC_SUPABASE_URL=upbiqtluqemrmonyghix.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### ✅ What You Need (CORRECT)
```
NEXT_PUBLIC_SUPABASE_URL=https://upbiqtluqemrmonyghix.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get-from-supabase-dashboard>
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-dashboard>
```

The keys you're using are the **local demo keys**. You MUST get the real keys from your Supabase project dashboard!

