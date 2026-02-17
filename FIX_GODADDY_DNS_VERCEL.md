# Fix GoDaddy DNS for Vercel Domain

## Current Situation
- ✅ Domain `provenance.guru` is added to Vercel
- ⚠️ DNS records in GoDaddy aren't propagating (all red X's)
- Need to match GoDaddy DNS records to what Vercel expects

## Step 1: Get Exact DNS Records from Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Domains**
4. Click on `provenance.guru`
5. **Look for the DNS configuration section**

Vercel will show you something like:

**For Root Domain (provenance.guru):**
- Option A: `A` record with IP address (e.g., `76.76.21.21`)
- Option B: `ALIAS` or `CNAME` record (e.g., `cname.vercel-dns.com`)

**For WWW Subdomain (www.provenance.guru):**
- `CNAME` record pointing to a Vercel CNAME

**Important**: Write down or screenshot the EXACT values Vercel shows you.

## Step 2: Check Current GoDaddy DNS Records

1. Log in to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products** → `provenance.guru` → **DNS**
3. Look at your current records

You mentioned you have:
- ALIAS record for `*` → `cname.vercel-dns-017.com.`
- ALIAS record → `cname.vercel-dns-017.com.`
- CAA record

## Step 3: Fix GoDaddy DNS Records

### Option A: If Vercel Shows A Records (IP Addresses)

**Remove existing ALIAS records and add A records:**

1. In GoDaddy DNS, **DELETE**:
   - The ALIAS record for `*` (root domain)
   - Any other ALIAS records for root domain

2. **ADD A record** for root domain:
   - **Type**: `A`
   - **Name**: `@` (or leave blank/empty)
   - **Value**: [The IP address from Vercel, e.g., `76.76.21.21`]
   - **TTL**: `600` (or `1 Hour`)
   - Click **Save**

3. **ADD CNAME record** for www:
   - **Type**: `CNAME`
   - **Name**: `www`
   - **Value**: [The CNAME value from Vercel]
   - **TTL**: `600` (or `1 Hour`)
   - Click **Save**

### Option B: If Vercel Shows ALIAS/CNAME for Root

**Some GoDaddy plans don't support ALIAS for root domain.**

If Vercel shows ALIAS/CNAME but GoDaddy doesn't support it:

1. **Contact Vercel support** to get A record IP addresses instead
2. **OR** use these Vercel IP addresses (verify with Vercel first):
   - `76.76.21.21`
   - `76.223.126.88`

3. **Add A records** in GoDaddy:
   - Type: `A`
   - Name: `@`
   - Value: `76.76.21.21`
   - TTL: `600`
   - Save

   - Type: `A`
   - Name: `@`
   - Value: `76.223.126.88`
   - TTL: `600`
   - Save

4. **Add CNAME for www**:
   - Type: `CNAME`
   - Name: `www`
   - Value: [CNAME from Vercel]
   - TTL: `600`
   - Save

### Option C: If Your GoDaddy Plan Supports ALIAS

If Vercel shows ALIAS and your GoDaddy plan supports it:

1. **Update the ALIAS record**:
   - Make sure it matches EXACTLY what Vercel shows
   - The value should match Vercel's CNAME/ALIAS value exactly
   - Remove the `*` record if it exists
   - Keep only the root domain ALIAS

2. **Verify the CNAME value**:
   - Should match what Vercel shows (might be `cname.vercel-dns.com` or similar)
   - The `cname.vercel-dns-017.com.` you have might be wrong
   - Check Vercel for the exact value

## Step 4: Verify Records Match

**Compare:**
- What Vercel shows in Settings → Domains
- What you have in GoDaddy DNS

They must match EXACTLY:
- Record type (A, ALIAS, CNAME)
- Name (@, www, etc.)
- Value (IP address or CNAME value)
- No trailing dots unless Vercel shows them

## Step 5: Wait and Test

1. **Wait 10-15 minutes** after saving DNS records
2. **Check DNS propagation**: [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru)
3. **Check Vercel status**: Settings → Domains → `provenance.guru`
   - Should show "Valid Configuration" or "Pending" (not "Invalid")
4. **Test domain**: Visit `https://provenance.guru`

## Common Issues

### Issue: ALIAS Records Not Working

**Symptom**: ALIAS records exist but DNS doesn't propagate

**Solution**: 
- GoDaddy may not support ALIAS for root domain on your plan
- Switch to A records instead
- Get IP addresses from Vercel support or use standard Vercel IPs

### Issue: Wrong CNAME Value

**Symptom**: CNAME value doesn't match Vercel

**Solution**:
- The value `cname.vercel-dns-017.com.` might be wrong
- Check Vercel Dashboard → Domains → Your domain for exact value
- It might be `cname.vercel-dns.com` (without the `-017`)

### Issue: Multiple Conflicting Records

**Symptom**: Multiple A/ALIAS records for root domain

**Solution**:
- Remove ALL existing A, ALIAS, and CNAME records for root domain
- Add only what Vercel requires
- Keep CAA records (they're fine)

## Quick Checklist

- [ ] Checked Vercel Dashboard → Settings → Domains → `provenance.guru` for exact DNS records
- [ ] Removed all old/conflicting DNS records in GoDaddy
- [ ] Added DNS records exactly as Vercel shows
- [ ] Records match Vercel exactly (type, name, value)
- [ ] Saved records in GoDaddy
- [ ] Waited 10-15 minutes
- [ ] Checked [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru) - should show green checkmarks
- [ ] Vercel shows "Valid Configuration" or "Pending"
- [ ] `https://provenance.guru` loads your app

## Next Steps After DNS Works

Once DNS propagates and `https://provenance.guru` loads:

1. **Update Supabase**:
   - Authentication → URL Configuration
   - Site URL: `https://provenance.guru` (no trailing slash)
   - Redirect URLs: `https://provenance.guru/auth/callback`

2. **Update Vercel Environment Variables**:
   - Settings → Environment Variables
   - `NEXT_PUBLIC_SITE_URL=https://provenance.guru`
   - Redeploy

3. **Test OAuth** - should now work!

## Need Help?

If DNS still doesn't work after following these steps:

1. **Screenshot** what Vercel shows in Settings → Domains → Your domain
2. **Screenshot** your GoDaddy DNS records
3. Compare them - they must match exactly
4. Contact Vercel support if records don't match or if you need A record IPs
