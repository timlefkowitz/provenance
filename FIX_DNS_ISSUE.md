# Fix DNS Issue - "Safari Can't Find the Server"

## Problem
When trying to access `https://provenance.guru`, you get:
```
Safari can't find the server "provenance.guru"
```

This means the domain is not resolving - DNS records are either missing, incorrect, or haven't propagated yet.

## Quick Diagnosis

### Step 1: Check if Domain is Added to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Domains**
4. Check if `provenance.guru` is listed
5. Check the status:
   - ✅ **Valid Configuration** = DNS is correct and working
   - ⚠️ **Invalid Configuration** = DNS records are wrong or missing
   - ⏳ **Pending** = DNS is still propagating

**If the domain is NOT listed:**
- You need to add it first (see Step 2 below)

**If the domain shows "Invalid Configuration":**
- DNS records in GoDaddy don't match what Vercel expects
- See Step 3 below

### Step 2: Add Domain to Vercel (if not added)

1. In Vercel Dashboard → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `provenance.guru`
4. Click **Add**
5. Vercel will show you the DNS records you need to add

### Step 3: Configure DNS Records in GoDaddy

Vercel will provide you with specific DNS records. Typically you need:

**For Root Domain (provenance.guru):**
- **Type**: `A`
- **Name**: `@` (or leave blank/empty)
- **Value**: Vercel's IP address (Vercel will show you the exact IP, usually `76.76.21.21` or similar)
- **TTL**: `600` (or default)

**For WWW Subdomain (www.provenance.guru):**
- **Type**: `CNAME`
- **Name**: `www`
- **Value**: `cname.vercel-dns.com` (or the exact CNAME Vercel provides)
- **TTL**: `600` (or default)

**Steps in GoDaddy:**
1. Log in to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products** → Select `provenance.guru` → **DNS** (or **Manage DNS**)
3. **Remove any existing A or CNAME records** for the root domain (they might conflict)
4. Add the A record:
   - Click **Add** or **+**
   - Type: `A`
   - Name: `@` (or leave blank)
   - Value: [The IP address from Vercel]
   - TTL: `600`
   - Save
5. Add the CNAME record:
   - Click **Add** or **+**
   - Type: `CNAME`
   - Name: `www`
   - Value: [The CNAME value from Vercel, usually `cname.vercel-dns.com`]
   - TTL: `600`
   - Save

### Step 4: Wait for DNS Propagation

DNS changes can take:
- **5-60 minutes** (most common)
- **Up to 24-48 hours** (rare, but possible)

**Check DNS Propagation:**
1. Use [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru) to check if DNS has propagated globally
2. Or use command line:
   ```bash
   dig provenance.guru +short
   ```
   Should return an IP address (the one from Vercel)

**Check in Vercel:**
- Go to **Settings** → **Domains**
- Wait for status to change to **Valid Configuration**
- This means DNS is working and Vercel can issue an SSL certificate

### Step 5: Verify Domain Works

Once DNS has propagated:
1. Visit `https://provenance.guru` - should load your Vercel app
2. Check for SSL certificate (padlock icon in browser)
3. If it works, then OAuth redirects should work too

## Common Issues

### Issue 1: Domain Not Resolving at All
**Symptom**: `dig provenance.guru` returns nothing

**Causes**:
- Domain not added to Vercel
- DNS records not added to GoDaddy
- DNS records have wrong values
- DNS hasn't propagated yet

**Fix**: Follow Steps 2-4 above

### Issue 2: Domain Resolves but Shows Vercel Error Page
**Symptom**: Domain resolves but shows "404" or "Deployment not found"

**Causes**:
- Domain added to wrong Vercel project
- Project not deployed
- DNS pointing to wrong Vercel project

**Fix**: 
- Verify domain is added to the correct Vercel project
- Check that project has active deployments

### Issue 3: DNS Records Don't Match Vercel
**Symptom**: Vercel shows "Invalid Configuration"

**Causes**:
- A record has wrong IP address
- CNAME has wrong value
- Conflicting DNS records
- TTL too high (slows propagation)

**Fix**:
- Delete all existing A and CNAME records for root domain
- Add exactly what Vercel shows you
- Use TTL of 600 or lower

### Issue 4: SSL Certificate Not Issued
**Symptom**: Domain works on HTTP but not HTTPS, or browser shows security warning

**Causes**:
- DNS not fully propagated
- Domain status not "Valid Configuration" in Vercel
- Vercel hasn't issued certificate yet (takes 5-10 minutes after DNS)

**Fix**:
- Wait 5-10 minutes after DNS shows "Valid Configuration"
- Check Vercel domain status
- Contact Vercel support if >24 hours

## Quick Checklist

Before OAuth can work, verify:

- [ ] Domain `provenance.guru` is added to Vercel project
- [ ] DNS A record added in GoDaddy (points to Vercel IP)
- [ ] DNS CNAME record added in GoDaddy (for www subdomain)
- [ ] Vercel shows "Valid Configuration" for the domain
- [ ] `dig provenance.guru` returns an IP address
- [ ] `https://provenance.guru` loads your app (not an error page)
- [ ] SSL certificate is active (padlock icon in browser)

**Only after all of the above work should you:**
- Configure Supabase Site URL and Redirect URLs
- Test OAuth

## Testing DNS Locally

After making DNS changes, you can test locally:

```bash
# Check if domain resolves
dig provenance.guru +short

# Should return an IP address like: 76.76.21.21

# Check DNS propagation globally
# Visit: https://www.whatsmydns.net/#A/provenance.guru
```

## Next Steps After DNS Works

Once `https://provenance.guru` loads your app:

1. **Update Supabase** (Authentication → URL Configuration):
   - Site URL: `https://provenance.guru` (no trailing slash)
   - Redirect URLs: `https://provenance.guru/auth/callback`

2. **Update Vercel Environment Variables**:
   - `NEXT_PUBLIC_SITE_URL=https://provenance.guru`

3. **Redeploy** your Vercel project

4. **Test OAuth** - it should now redirect correctly
