# Fixing OAuth Redirect to Localhost Issue

If you're being redirected to localhost after OAuth login on Vercel, you need to configure Supabase's redirect URLs correctly.

## Supabase Dashboard Configuration

1. Go to your Supabase Dashboard → **Authentication** → **URL Configuration**

2. **Site URL**: Set this to your Vercel domain
   ```
   https://your-app.vercel.app
   ```

3. **Redirect URLs**: Add both your Vercel and localhost URLs:
   ```
   https://your-app.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```

## Google Cloud Console Configuration

1. Go to Google Cloud Console → **APIs & Services** → **Credentials**

2. Find your OAuth 2.0 Client ID

3. **Authorized redirect URIs**: Add your Supabase callback URL:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
   (This is the Supabase callback URL, NOT your app URL)

4. **Authorized JavaScript origins**: Add:
   ```
   https://your-project-id.supabase.co
   ```

## How It Works

1. User clicks "Sign in with Google" on your Vercel app
2. App redirects to Supabase OAuth endpoint with `redirectTo` parameter
3. Supabase redirects to Google OAuth
4. Google redirects back to Supabase callback (`https://your-project.supabase.co/auth/v1/callback`)
5. Supabase validates the `redirectTo` URL against allowed redirect URLs
6. If valid, Supabase redirects to your app's callback route (`/auth/callback`)
7. Your callback route then redirects to the home page using the request origin

## Troubleshooting

- **Still redirecting to localhost?** Check that your Vercel domain is in Supabase's Redirect URLs list
- **Getting "redirect_uri_mismatch"?** Make sure the Supabase callback URL is in Google Cloud Console's Authorized redirect URIs
- **Session not persisting?** Make sure your Supabase environment variables are set correctly in Vercel

