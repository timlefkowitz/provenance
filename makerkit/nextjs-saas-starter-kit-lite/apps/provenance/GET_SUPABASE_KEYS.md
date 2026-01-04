# How to Get Your Supabase Keys

## Important Note About Your Key

The key you mentioned (`sb_publishable_-R4Da6crRk6avNIguFeJsQ_dGfOhXA3`) appears to be incomplete or from a different format. 

Standard Supabase API keys are **JWT tokens** that start with `eyJ...` and are much longer (typically 200+ characters).

## Getting Your Complete Supabase Credentials

### Step 1: Go to Your Supabase Dashboard

1. Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your project (or create a new one if you don't have one)

### Step 2: Navigate to API Settings

1. In the left sidebar, click **Settings** (gear icon ⚙️)
2. Click **API** in the settings menu

### Step 3: Copy Your Credentials

You'll see three things you need:

#### 1. Project URL
```
https://xxxxxxxxxxxxx.supabase.co
```
- This is your `NEXT_PUBLIC_SUPABASE_URL`
- Copy the entire URL

#### 2. Project API keys

You'll see two keys:

**anon public** (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Click the **"Reveal"** button to show it
- It will look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- Click **"Copy"** to copy it

**service_role secret** (this is your `SUPABASE_SERVICE_ROLE_KEY`)
- Click the **"Reveal"** button to show it
- It will also look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`
- Click **"Copy"** to copy it
- ⚠️ **Keep this secret!** Never expose it in client-side code

## Setting Up Both Environments

### For Local Development (Already Set Up ✅)

Your `.env.local` file already has the local Supabase settings:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (local key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (local key)
```

This is correct for local development! ✅

### For Production (Vercel)

You need to set these in your Vercel dashboard:

1. Go to your Vercel project
2. Navigate to **Settings** → **Environment Variables**
3. Add these three variables (use your **remote** Supabase credentials):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your remote anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your remote service_role key)
```

**Important:**
- Make sure to set them for **Production**, **Preview**, and **Development** environments
- Use your **remote** Supabase credentials (not the local ones)
- The keys should be long JWT tokens starting with `eyJ...`

## About the `sb_publishable_` Key

If you're seeing a key that starts with `sb_publishable_`, it might be:
- From Supabase's newer CLI or a different product
- An incomplete key
- From a different service

For Next.js applications, you need the standard Supabase API keys (JWT tokens) from the API settings page, not publishable keys.

## Quick Checklist

- [ ] Go to Supabase Dashboard → Settings → API
- [ ] Copy your **Project URL** (starts with `https://`)
- [ ] Copy your **anon public** key (starts with `eyJ...`)
- [ ] Copy your **service_role secret** key (starts with `eyJ...`)
- [ ] Add all three to Vercel Environment Variables
- [ ] Make sure local `.env.local` has local Supabase settings (already done ✅)

## Need Help?

If you can't find these keys or they look different, let me know and I can help troubleshoot!

