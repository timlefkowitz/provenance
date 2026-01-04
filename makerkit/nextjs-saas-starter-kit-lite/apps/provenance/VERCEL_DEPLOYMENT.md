# Vercel Deployment Guide

## Prerequisites

1. A Supabase project (cloud instance, not local)
2. Vercel account
3. Environment variables configured in Vercel

## Environment Variables

Set the following environment variables in your Vercel project settings:

### Required Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (keep this secret!)

### Optional Variables

- `NEXT_PUBLIC_SITE_URL` - Your production site URL (e.g., `https://your-domain.vercel.app`)
- `NEXT_PUBLIC_DEFAULT_LOCALE` - Default language (defaults to `en`)

## Deployment Steps

### Option 1: Using vercel.json (Recommended)

The repository includes a `vercel.json` file at the root that configures the monorepo deployment. Simply:

1. **Connect your repository to Vercel**
   - Go to Vercel dashboard
   - Import your Git repository
   - Vercel will use the `vercel.json` configuration automatically

2. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables listed above
   - Make sure to set them for Production, Preview, and Development environments

3. **Deploy**
   - Push to your main branch or trigger a manual deployment
   - Vercel will automatically build and deploy

### Option 2: Manual Configuration

If you prefer to configure manually in Vercel dashboard:

1. **Connect your repository to Vercel**
   - Go to Vercel dashboard
   - Import your Git repository

2. **Configure Project Settings**
   - **Root Directory**: Set to `apps/provenance`
   - **Framework Preset**: Next.js
   - **Build Command**: `cd apps/provenance && pnpm build`
   - **Output Directory**: `apps/provenance/.next`
   - **Install Command**: `pnpm install`

3. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables listed above
   - Make sure to set them for Production, Preview, and Development environments

4. **Deploy**
   - Push to your main branch or trigger a manual deployment

## Database Migrations

Before deploying, make sure to run your database migrations on your Supabase cloud instance:

1. Connect to your Supabase project dashboard
2. Go to SQL Editor
3. Run the migrations from `apps/web/supabase/migrations/`:
   - `20250103000000_create_artworks.sql`
   - `20250104000000_add_provenance_fields.sql`
4. Ensure all tables and RLS policies are set up correctly
5. Create the `artworks` storage bucket if it doesn't exist (or it will be created automatically on first upload)

## Important Notes

- The build script uses `next build` directly (without dotenv-cli) for production, which works with Vercel's environment variables
- For local development, use `pnpm build:local` which includes dotenv-cli
- Make sure your Supabase project has the storage bucket `artworks` created, or it will be created automatically on first artwork upload

## Troubleshooting

### Build Fails
- Check that all environment variables are set in Vercel
- Verify that `pnpm` is installed (Vercel should auto-detect pnpm from `packageManager` field)
- Check build logs for specific errors
- Ensure the root directory is correctly set to `apps/provenance`

### Runtime Errors
- Verify Supabase connection strings are correct
- Check that RLS policies allow the operations you need
- Ensure storage buckets are created and configured
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly (needed for bucket creation)

### Monorepo Issues
- Make sure the root directory is set to `apps/provenance` in Vercel
- Verify that workspace dependencies are resolving correctly
- Check that `pnpm-workspace.yaml` is present at the root
- Ensure all workspace packages are properly linked

