# Complete Google Sign-In Setup for provenance.guru

## Prerequisites
- ✅ Domain `provenance.guru` is working (DNS resolved)
- ✅ Domain is added to Vercel
- ✅ `https://provenance.guru` loads your app

## Step 1: Configure Supabase (2-3 minutes)

### 1.1 Update Site URL

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. **Delete** the current Site URL completely
5. **Retype** (don't copy-paste) exactly:
   ```
   https://provenance.guru
   ```
   ⚠️ **Critical**:
   - Must start with `https://` (no spaces before)
   - Must NOT have a trailing slash
   - Must NOT have leading or trailing spaces
   - Type it manually to avoid invisible characters

### 1.2 Update Redirect URLs

In the same **URL Configuration** section:

1. **Delete all existing Redirect URLs**
2. **Add these URLs one by one** (one per line, type manually):
   ```
   https://provenance.guru/auth/callback
   http://localhost:3000/auth/callback
   ```
   ⚠️ **Important**:
   - Each URL must be on a separate line
   - Type them manually (don't copy-paste)
   - No trailing slashes
   - No leading/trailing spaces
   - Must match EXACTLY: `https://provenance.guru/auth/callback`

3. If you have a `www` subdomain configured, also add:
   ```
   https://www.provenance.guru/auth/callback
   ```

4. Click **Save**

### 1.3 Enable Google Provider in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list
3. Make sure it's **Enabled** (toggle should be ON)
4. If you need to configure Google OAuth credentials:
   - You'll need Client ID and Client Secret from Google Cloud Console
   - Enter them in the Google provider settings

## Step 2: Configure Google Cloud Console (3-5 minutes)

### 2.1 Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (the one used for Supabase OAuth)
3. Navigate to **APIs & Services** → **Credentials**

### 2.2 Find Your OAuth 2.0 Client ID

1. Look for **OAuth 2.0 Client IDs** in the list
2. Find the one used for Supabase (usually named something like "Supabase" or "Web client")
3. Click on it to view details, or click **Edit** (pencil icon)

### 2.3 Update Authorized JavaScript Origins

In the OAuth client configuration, find **Authorized JavaScript origins**:

1. Click **+ ADD URI**
2. Add these origins (one at a time):
   ```
   https://provenance.guru
   https://www.provenance.guru
   https://your-project-id.supabase.co
   ```
   ⚠️ **Important**:
   - Each origin must be on a separate line
   - Must include `https://`
   - No trailing slashes
   - Replace `your-project-id` with your actual Supabase project ID

### 2.4 Update Authorized Redirect URIs

In the same OAuth client configuration, find **Authorized redirect URIs**:

1. **Verify** this URI is already there (it should be):
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
   - Replace `your-project-id` with your actual Supabase project ID
   - This is the Supabase callback URL, NOT your app URL
   - If it's not there, click **+ ADD URI** and add it

2. **Do NOT add** `https://provenance.guru/auth/callback` here
   - Google redirects to Supabase, not directly to your app
   - Supabase then redirects to your app

3. Click **Save**

## Step 3: Update Vercel Environment Variables (1-2 minutes)

### 3.1 Update NEXT_PUBLIC_SITE_URL

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Find or add: `NEXT_PUBLIC_SITE_URL`
5. Set the value to:
   ```
   https://provenance.guru
   ```
6. Make sure it's set for:
   - ✅ **Production**
   - ✅ **Preview**
   - ✅ **Development**
7. Click **Save**

### 3.2 Redeploy

After updating environment variables:

1. Go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Click **Redeploy**
   - Or push a new commit to trigger a new deployment

## Step 4: Verify Configuration

### 4.1 Check Supabase Configuration

- [ ] Site URL: `https://provenance.guru` (no trailing slash)
- [ ] Redirect URLs includes: `https://provenance.guru/auth/callback`
- [ ] Redirect URLs includes: `http://localhost:3000/auth/callback`
- [ ] Google provider is enabled in Supabase

### 4.2 Check Google Cloud Console

- [ ] Authorized JavaScript Origins includes: `https://provenance.guru`
- [ ] Authorized JavaScript Origins includes: `https://your-project-id.supabase.co`
- [ ] Authorized Redirect URIs includes: `https://your-project-id.supabase.co/auth/v1/callback`

### 4.3 Check Vercel

- [ ] `NEXT_PUBLIC_SITE_URL=https://provenance.guru` is set
- [ ] Project has been redeployed after environment variable change

## Step 5: Test Google Sign-In

### 5.1 Clear Browser Cache

1. Clear your browser cache
2. Or use an incognito/private window
3. This ensures no cached redirects interfere

### 5.2 Test the Flow

1. Visit `https://provenance.guru`
2. Click "Sign in with Google"
3. You should be redirected to Google OAuth
4. After authorizing, you should be redirected back to:
   ```
   https://provenance.guru/auth/callback?code=...
   ```
5. Then automatically redirected to your app (likely `/portal` based on your callback route)

### 5.3 Troubleshooting

**If you get redirected to `https://provenance.guru/?code=...`:**

- The `redirectTo` URL doesn't match Supabase Redirect URLs
- Check Supabase Redirect URLs match exactly: `https://provenance.guru/auth/callback`
- Make sure there are no trailing slashes or spaces

**If you get "redirect_uri_mismatch" error:**

- Check Google Cloud Console Authorized Redirect URIs
- Must include: `https://your-project-id.supabase.co/auth/v1/callback`
- Do NOT add your app URL here

**If you get "origin_mismatch" error:**

- Check Google Cloud Console Authorized JavaScript Origins
- Must include: `https://provenance.guru`
- Must include: `https://your-project-id.supabase.co`

**If sign-in works but redirects to wrong page:**

- Check your callback route: `src/app/auth/callback/route.ts`
- It should redirect to `/portal` (as configured)

## How It Works

1. User clicks "Sign in with Google" on `https://provenance.guru`
2. App constructs `redirectTo`: `https://provenance.guru/auth/callback`
3. App redirects to Supabase OAuth endpoint with `redirectTo` parameter
4. Supabase redirects to Google OAuth (with Google Client ID)
5. User authorizes on Google
6. Google redirects back to Supabase: `https://your-project-id.supabase.co/auth/v1/callback`
7. Supabase validates the `redirectTo` URL against allowed Redirect URLs
8. If valid, Supabase redirects to: `https://provenance.guru/auth/callback?code=...`
9. Your callback route processes the code and creates a session
10. User is redirected to `/portal` (or your configured redirect path)

## Quick Checklist

Before testing, verify all of these:

- [ ] Supabase Site URL: `https://provenance.guru` (no trailing slash)
- [ ] Supabase Redirect URLs: `https://provenance.guru/auth/callback` (exact match)
- [ ] Google Cloud Authorized JavaScript Origins: `https://provenance.guru`
- [ ] Google Cloud Authorized Redirect URIs: `https://your-project-id.supabase.co/auth/v1/callback`
- [ ] Vercel `NEXT_PUBLIC_SITE_URL=https://provenance.guru`
- [ ] Vercel project redeployed
- [ ] Browser cache cleared
- [ ] Domain `https://provenance.guru` loads your app

## Need Help?

If Google sign-in still doesn't work:

1. **Check Supabase Logs**: Dashboard → Logs → API Logs
2. **Check browser console** for JavaScript errors
3. **Check network tab** to see where redirects are going
4. **Verify all URLs match exactly** (no trailing slashes, no spaces)
