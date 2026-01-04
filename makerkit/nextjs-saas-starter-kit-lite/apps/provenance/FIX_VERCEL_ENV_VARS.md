# Fix Vercel Environment Variables

## ❌ Current Issues

1. **Missing `https://` in URL**: Your URL is missing the protocol
2. **Using Local Keys**: You're using local Supabase demo keys instead of your remote project keys

## ✅ Correct Environment Variables for Vercel

### Step 1: Fix the Supabase URL

Your current URL:
```
upbiqtluqemrmonyghix.supabase.co
```

Should be:
```
https://upbiqtluqemrmonyghix.supabase.co
```

### Step 2: Get Your REAL Remote Supabase Keys

The keys you're using are the **local demo keys**. You need to get your **remote project keys**:

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `upbiqtluqemrmonyghix`
3. Go to **Settings** → **API**
4. Copy the following:

#### Project URL
```
https://upbiqtluqemrmonyghix.supabase.co
```

#### anon public key
- Click "Reveal" next to `anon public`
- Copy the full key (it will be a long JWT token starting with `eyJ...`)
- This is different from the local demo key!

#### service_role secret key
- Click "Reveal" next to `service_role secret`
- Copy the full key (it will be a long JWT token starting with `eyJ...`)
- This is different from the local demo key!

### Step 3: Update Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Update these three variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://upbiqtluqemrmonyghix.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-real-anon-key-from-dashboard>
SUPABASE_SERVICE_ROLE_KEY=<your-real-service-role-key-from-dashboard>
```

**Important:**
- Make sure to set them for **Production**, **Preview**, and **Development** environments
- The keys should be long JWT tokens (200+ characters) starting with `eyJ...`
- They should be DIFFERENT from the local demo keys

### Step 4: Redeploy

After updating the environment variables:
1. Go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger a new deployment

## How to Verify Your Keys Are Correct

### Local Keys (for .env.local - DO NOT use in Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### Remote Keys (for Vercel - MUST use these)
- URL: `https://upbiqtluqemrmonyghix.supabase.co` (with https://)
- Keys: Get from your Supabase dashboard (Settings → API)
- They will be DIFFERENT from the local keys above

## Still Getting 404?

If you've fixed the environment variables and still get 404:

1. **Check Build Logs**: Go to Vercel → Deployments → Click on the deployment → Check for build errors
2. **Verify Root Directory**: Should be `apps/provenance` in Vercel settings
3. **Check Build Output**: Make sure the build completes successfully
4. **Try Manual Configuration**: Remove `vercel.json` and configure manually in Vercel dashboard

