# Domain Setup Guide - Connecting GoDaddy Domain to Vercel, Supabase, and Google Cloud

This guide will walk you through connecting your GoDaddy domain to all three services: Vercel (hosting), Supabase (backend), and Google Cloud (OAuth).

## Prerequisites

- A domain registered on GoDaddy
- Access to your GoDaddy account
- Access to your Vercel project dashboard
- Access to your Supabase project dashboard
- Access to your Google Cloud Console (for OAuth)

---

## Step 1: Configure Domain in Vercel

### 1.1 Add Domain to Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter your domain (e.g., `yourdomain.com`)
6. Click **Add**

### 1.2 Configure DNS Records in GoDaddy

Vercel will provide you with DNS records to add. You'll typically need:

**For Root Domain (yourdomain.com):**
- **Type**: `A`
- **Name**: `@` (or leave blank)
- **Value**: Vercel's IP address (Vercel will show you the exact IP)
- **TTL**: `600` (or default)

**For WWW Subdomain (www.yourdomain.com):**
- **Type**: `CNAME`
- **Name**: `www`
- **Value**: `cname.vercel-dns.com` (or the CNAME Vercel provides)
- **TTL**: `600` (or default)

### 1.3 Add DNS Records in GoDaddy

1. Log in to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products** → Select your domain → **DNS** (or **Manage DNS**)
3. Find the DNS Management section
4. Add the records Vercel provided:
   - Click **Add** or **+** to add a new record
   - Enter the Type, Name, and Value as shown in Vercel
   - Save the record
5. Repeat for all records Vercel requires

**Note**: DNS changes can take 24-48 hours to propagate, but often work within a few hours.

### 1.4 Verify Domain in Vercel

1. Return to Vercel Dashboard → **Settings** → **Domains**
2. Wait for the domain status to show as **Valid Configuration**
3. Vercel will automatically issue an SSL certificate once DNS is configured

---

## Step 2: Configure Domain in Supabase

### 2.1 Update Site URL

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Update **Site URL** to your custom domain:
   ```
   https://yourdomain.com
   ```
   ⚠️ **Important**: 
   - Must include `https://`
   - Must NOT have a trailing slash
   - Must NOT have leading/trailing spaces

### 2.2 Update Redirect URLs

In the same **URL Configuration** section, update **Redirect URLs**:

Add these URLs (one per line):
```
https://yourdomain.com/auth/callback
https://www.yourdomain.com/auth/callback
http://localhost:3000/auth/callback
```

⚠️ **Important**: 
- Each URL must be on a separate line
- Must match EXACTLY what your app uses
- Include the protocol (`https://` or `http://`)
- No trailing slashes

### 2.3 Update Email Templates (Optional)

If you have email templates that include URLs, update them to use your custom domain:

1. Go to **Authentication** → **Email Templates**
2. Update any hardcoded URLs to use `https://yourdomain.com`

---

## Step 3: Configure Domain in Google Cloud Console (OAuth)

### 3.1 Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create one if needed)
3. Navigate to **APIs & Services** → **Credentials**

### 3.2 Update OAuth 2.0 Client ID

1. Find your OAuth 2.0 Client ID (the one used for Supabase Google OAuth)
2. Click **Edit** (pencil icon)

### 3.3 Update Authorized JavaScript Origins

Add your custom domain origins:
```
https://yourdomain.com
https://www.yourdomain.com
https://your-project-id.supabase.co
```

### 3.4 Update Authorized Redirect URIs

Add your Supabase callback URL (this should already be there, but verify):
```
https://your-project-id.supabase.co/auth/v1/callback
```

**Note**: The redirect URI should point to Supabase, NOT your custom domain. Supabase handles the OAuth callback and then redirects to your app.

### 3.5 Save Changes

Click **Save** to apply the changes.

---

## Step 4: Update Environment Variables

### 4.1 Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add or update:
   ```
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   ```
3. Make sure this is set for **Production**, **Preview**, and **Development** environments

### 4.2 Update Local Environment (Optional)

If you want to test with your domain locally, update `.env.local`:
```env
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

---

## Step 5: Update Application Code (if needed)

Check if your application code references the domain anywhere. Common places to check:

1. **Email templates** - Make sure they use `NEXT_PUBLIC_SITE_URL` or your domain
2. **OAuth redirects** - Should use environment variables
3. **API routes** - Should use relative URLs or environment variables

---

## Step 6: Verify Everything Works

### 6.1 Test Domain Access

1. Wait for DNS propagation (can take up to 48 hours, usually much faster)
2. Visit `https://yourdomain.com` - should load your Vercel app
3. Visit `https://www.yourdomain.com` - should also work

### 6.2 Test Authentication

1. Try signing up with email/password
2. Try signing in with Google OAuth
3. Verify redirects work correctly after authentication

### 6.3 Check SSL Certificate

1. Verify the padlock icon appears in your browser
2. Vercel automatically provisions SSL certificates via Let's Encrypt

---

## Troubleshooting

### DNS Not Propagating

- **Check DNS propagation**: Use [whatsmydns.net](https://www.whatsmydns.net) to check if DNS has propagated globally
- **Clear DNS cache**: On your local machine, try `sudo dscacheutil -flushcache` (macOS) or restart your router
- **Wait longer**: DNS can take up to 48 hours, though it's usually faster

### Domain Shows "Invalid Configuration" in Vercel

- **Check DNS records**: Make sure they match exactly what Vercel provided
- **Check TTL**: Lower TTL values (300-600) help with faster updates
- **Remove conflicting records**: Make sure there are no conflicting A or CNAME records

### OAuth Not Working After Domain Change

- **Verify Supabase Site URL**: Must match your domain exactly (with `https://`, no trailing slash)
- **Verify Supabase Redirect URLs**: Must include your domain's callback URL
- **Verify Google Cloud Console**: Must have your domain in Authorized JavaScript Origins
- **Clear browser cache**: Sometimes cached redirects cause issues

### SSL Certificate Not Issuing

- **Wait**: SSL certificates can take a few minutes to provision
- **Check DNS**: Make sure DNS is fully propagated
- **Contact Vercel Support**: If it's been more than 24 hours

### Mixed Content Warnings

- Make sure all URLs in your app use `https://` (not `http://`)
- Check that `NEXT_PUBLIC_SITE_URL` uses `https://`

---

## Quick Checklist

- [ ] Domain added to Vercel project
- [ ] DNS records added in GoDaddy (A record for root, CNAME for www)
- [ ] DNS propagated (check with whatsmydns.net)
- [ ] Domain shows "Valid Configuration" in Vercel
- [ ] Supabase Site URL updated to custom domain
- [ ] Supabase Redirect URLs include custom domain callback
- [ ] Google Cloud Console Authorized JavaScript Origins include custom domain
- [ ] `NEXT_PUBLIC_SITE_URL` environment variable set in Vercel
- [ ] SSL certificate issued (padlock icon in browser)
- [ ] Website loads at custom domain
- [ ] Authentication (email/password) works
- [ ] Google OAuth works
- [ ] Redirects after authentication work correctly

---

## Additional Notes

### Subdomains

If you want to use subdomains (e.g., `app.yourdomain.com`):
1. Add the subdomain in Vercel (Settings → Domains)
2. Add a CNAME record in GoDaddy pointing to Vercel
3. Update Supabase redirect URLs if needed
4. Update Google Cloud Console origins if needed

### Email Domain

If you want to send emails from your domain (e.g., `noreply@yourdomain.com`):
1. Set up SPF, DKIM, and DMARC records in GoDaddy DNS
2. Configure your email service (SendGrid, Mailgun, etc.) with your domain
3. Update `SMTP_FROM` in your environment variables

### Multiple Environments

Consider using subdomains for different environments:
- `yourdomain.com` - Production
- `staging.yourdomain.com` - Staging
- `dev.yourdomain.com` - Development

Each will need its own DNS records and configuration in all three services.

---

## Support Resources

- [Vercel Domain Documentation](https://vercel.com/docs/concepts/projects/domains)
- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [GoDaddy DNS Help](https://www.godaddy.com/help/manage-dns-680)
