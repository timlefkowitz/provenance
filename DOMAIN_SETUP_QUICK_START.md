# Domain Setup Quick Start Checklist

Use this checklist to quickly set up your GoDaddy domain with Vercel, Supabase, and Google Cloud.

## Prerequisites
- [ ] Domain registered on GoDaddy
- [ ] Access to GoDaddy DNS management
- [ ] Access to Vercel dashboard
- [ ] Access to Supabase dashboard  
- [ ] Access to Google Cloud Console

---

## Step 1: Vercel Domain Setup (5-10 minutes)

### In Vercel Dashboard:
1. [ ] Go to **Settings** → **Domains**
2. [ ] Click **Add Domain**
3. [ ] Enter your domain: `yourdomain.com`
4. [ ] Copy the DNS records Vercel provides (A record and CNAME)

### In GoDaddy:
1. [ ] Log in to GoDaddy
2. [ ] Go to **My Products** → Your Domain → **DNS**
3. [ ] Add **A record**:
   - Type: `A`
   - Name: `@` (or blank)
   - Value: [IP from Vercel]
   - TTL: `600`
4. [ ] Add **CNAME record**:
   - Type: `CNAME`
   - Name: `www`
   - Value: [CNAME from Vercel]
   - TTL: `600`
5. [ ] Save both records

### Wait & Verify:
- [ ] Wait 5-60 minutes for DNS propagation
- [ ] Check status in Vercel (should show "Valid Configuration")
- [ ] Visit `https://yourdomain.com` - should load your app

---

## Step 2: Supabase Configuration (2-3 minutes)

### In Supabase Dashboard:
1. [ ] Go to **Authentication** → **URL Configuration**
2. [ ] Update **Site URL** to: `https://yourdomain.com` (no trailing slash!)
3. [ ] Update **Redirect URLs** (one per line):
   ```
   https://yourdomain.com/auth/callback
   https://www.yourdomain.com/auth/callback
   http://localhost:3000/auth/callback
   ```
4. [ ] Click **Save**

---

## Step 3: Google Cloud Console (2-3 minutes)

### In Google Cloud Console:
1. [ ] Go to **APIs & Services** → **Credentials**
2. [ ] Find your OAuth 2.0 Client ID (used for Supabase)
3. [ ] Click **Edit** (pencil icon)
4. [ ] Add to **Authorized JavaScript Origins**:
   ```
   https://yourdomain.com
   https://www.yourdomain.com
   https://your-project-id.supabase.co
   ```
5. [ ] Verify **Authorized Redirect URIs** includes:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
6. [ ] Click **Save**

---

## Step 4: Environment Variables (1-2 minutes)

### In Vercel Dashboard:
1. [ ] Go to **Settings** → **Environment Variables**
2. [ ] Add/Update: `NEXT_PUBLIC_SITE_URL`
3. [ ] Value: `https://yourdomain.com`
4. [ ] Set for: **Production**, **Preview**, and **Development**
5. [ ] Click **Save**

### Redeploy:
- [ ] Go to **Deployments** tab
- [ ] Click **Redeploy** on latest deployment (or push a new commit)

---

## Step 5: Testing (5 minutes)

### Test Domain:
- [ ] Visit `https://yourdomain.com` - loads correctly
- [ ] Visit `https://www.yourdomain.com` - loads correctly
- [ ] SSL certificate active (padlock icon in browser)

### Test Authentication:
- [ ] Sign up with email/password - works
- [ ] Sign in with Google OAuth - works
- [ ] Redirects after auth work correctly

### Test Email Links:
- [ ] Check welcome email - links use your domain
- [ ] Check certification email - links use your domain

---

## Troubleshooting Quick Fixes

### DNS Not Working?
- Check DNS propagation: [whatsmydns.net](https://www.whatsmydns.net)
- Verify records match Vercel exactly
- Wait up to 48 hours (usually much faster)

### OAuth Not Working?
- Verify Supabase Site URL has `https://` and no trailing slash
- Verify Google Cloud has your domain in Authorized JavaScript Origins
- Clear browser cache

### SSL Not Issued?
- Wait 5-10 minutes after DNS propagates
- Check domain shows "Valid Configuration" in Vercel
- Contact Vercel support if >24 hours

---

## What's Your Domain?

Replace `yourdomain.com` with your actual domain throughout this checklist.

**Example**: If your domain is `provenance.guru`, use:
- `https://provenance.guru` (not `https://provenance.guru/`)
- `https://www.provenance.guru`
- `https://provenance.guru/auth/callback`

---

## Need Help?

See the detailed guide: `DOMAIN_SETUP_GUIDE.md`
