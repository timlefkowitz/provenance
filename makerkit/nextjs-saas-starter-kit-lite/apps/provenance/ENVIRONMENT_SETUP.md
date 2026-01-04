# Environment Setup Guide

## Overview

Your application uses different Supabase instances depending on the environment:

- **Local Development**: Connects to local Supabase (Docker)
- **Production (Vercel)**: Connects to remote Supabase cloud project

## Local Development Setup

### 1. Local Supabase (Docker)

Your `.env.local` file should contain:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

**Note**: These are the default local Supabase keys. Make sure your local Supabase Docker instance is running.

### 2. Running Local Development

```bash
cd apps/provenance
pnpm dev
```

The app will automatically use the `.env.local` file and connect to your local Supabase.

## Production Setup (Vercel)

### 1. Create Remote Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project (or use an existing one)
3. Wait for the project to be fully provisioned

### 2. Get Your Remote Supabase Credentials

In your Supabase project dashboard:
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key**
   - **service_role key** (keep this secret!)

### 3. Run Database Migrations on Remote Supabase

Before deploying, you need to apply your database migrations to the remote Supabase:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migrations from `apps/web/supabase/migrations/`:
   - `20241219010757_schema.sql` (if it exists)
   - `20250103000000_create_artworks.sql`
   - `20250104000000_add_provenance_fields.sql`

**Or use Supabase CLI:**
```bash
# Link to your remote project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

### 4. Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables for **Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important**: 
- Use your **remote Supabase** credentials (not local)
- Make sure to set them for all environments (Production, Preview, Development)
- The `SUPABASE_SERVICE_ROLE_KEY` should be kept secret and never exposed to the client

### 5. Create Storage Bucket on Remote Supabase

The `artworks` storage bucket will be created automatically on first upload, but you can also create it manually:

1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Name it `artworks`
4. Make it **Public**
5. Set allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
6. Set file size limit: `10485760` (10MB)

## How It Works

The application automatically detects which environment it's running in:

- **Local**: Reads from `.env.local` file → connects to local Supabase
- **Vercel**: Reads from environment variables → connects to remote Supabase

The code uses `process.env.NEXT_PUBLIC_SUPABASE_URL` which is automatically set based on the environment.

## Verifying Your Setup

### Check Local Connection
```bash
# Make sure local Supabase is running
supabase status

# Check your .env.local file has local Supabase URL
cat apps/provenance/.env.local
```

### Check Production Connection
1. Deploy to Vercel
2. Check Vercel deployment logs for any connection errors
3. Test the deployed app - it should connect to your remote Supabase

## Troubleshooting

### Local App Not Connecting
- Ensure Supabase Docker is running: `supabase start`
- Check `.env.local` file exists and has correct local URLs
- Verify local Supabase is accessible at `http://127.0.0.1:54321`

### Production App Not Connecting
- Verify environment variables are set in Vercel dashboard
- Check that you're using **remote** Supabase credentials (not local)
- Ensure migrations have been run on remote Supabase
- Check Vercel deployment logs for connection errors

### Data Not Syncing
- **Local and Production use separate databases** - they don't sync automatically
- Data created locally stays in your local Supabase
- Data created in production stays in your remote Supabase
- This is by design - local is for development, production is for users

## Best Practices

1. **Never commit `.env.local`** - it's already in `.gitignore`
2. **Use different Supabase projects** for staging and production if needed
3. **Keep service role key secret** - never expose it in client-side code
4. **Run migrations on remote** before deploying new features
5. **Test locally first** before deploying to production

