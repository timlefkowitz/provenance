# Fix DNS - All Red X's (Not Propagating)

## Problem
All DNS propagation checks show red X's, meaning DNS records aren't propagating at all.

## Common Causes

1. **DNS records not actually saved/active in GoDaddy**
2. **Domain not added to Vercel**
3. **Conflicting DNS records**
4. **ALIAS records not supported by GoDaddy** (some plans don't support ALIAS)
5. **Wrong DNS records type**

## Step-by-Step Fix

### Step 1: Verify Domain is Added to Vercel

**Critical first step!**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Domains**
4. **Check if `provenance.guru` is listed**

**If NOT listed:**
- Click **Add Domain**
- Enter: `provenance.guru`
- Click **Add**
- Vercel will show you the EXACT DNS records to use
- **Important**: Use the records Vercel shows, not generic ones

**If it IS listed:**
- Note the status
- If it shows "Invalid Configuration", Vercel will tell you what's wrong

### Step 2: Check GoDaddy DNS Records

1. Log in to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products** → `provenance.guru` → **DNS**
3. **Remove ALL existing A, ALIAS, and CNAME records** for the root domain
4. **Wait 5 minutes** for changes to take effect

### Step 3: Use Vercel's Exact DNS Records

**Important**: Don't use generic Vercel DNS records. Use the EXACT ones Vercel shows for your domain.

In Vercel Dashboard → Settings → Domains → `provenance.guru`, you should see something like:

**For Root Domain:**
- Type: `A` or `ALIAS`
- Name: `@` (or blank)
- Value: An IP address or CNAME value (Vercel will show you)

**For WWW:**
- Type: `CNAME`
- Name: `www`
- Value: A CNAME value (Vercel will show you)

### Step 4: Add DNS Records in GoDaddy

**Option A: If Vercel shows an A record (IP address)**

1. In GoDaddy DNS, add:
   - **Type**: `A`
   - **Name**: `@` (or leave blank/empty)
   - **Value**: [The IP address from Vercel]
   - **TTL**: `600`
   - **Save**

2. For www subdomain:
   - **Type**: `CNAME`
   - **Name**: `www`
   - **Value**: [The CNAME value from Vercel]
   - **TTL**: `600`
   - **Save**

**Option B: If Vercel shows ALIAS/CNAME for root**

Some domain registrars (including some GoDaddy plans) don't support ALIAS records for the root domain. In this case:

1. **Check if your GoDaddy plan supports ALIAS**
   - If not, you'll need to use A records instead
   - Contact GoDaddy support or check your plan features

2. **Alternative: Use A records**
   - Vercel should provide IP addresses you can use
   - If Vercel only shows CNAME, contact Vercel support for A record IPs

### Step 5: Verify Records Are Saved

1. In GoDaddy DNS management, verify:
   - Records are listed and saved
   - No error messages
   - TTL values are set (600 or default)

2. **Wait 5-10 minutes** after saving

3. Check again: [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru)

### Step 6: If Still Not Working

**Check for conflicting records:**
- Remove any other A, ALIAS, or CNAME records for root domain
- Keep only the ones Vercel requires
- Remove any old/duplicate records

**Verify GoDaddy DNS is active:**
- Make sure DNS management is enabled for the domain
- Check if domain is locked (shouldn't affect DNS, but verify)

**Contact support:**
- If ALIAS records aren't working, contact GoDaddy to verify your plan supports them
- If Vercel shows different records than what you have, contact Vercel support

## Alternative: Use A Records Instead of ALIAS

If ALIAS records aren't working, you can use A records:

1. **Get Vercel's IP addresses:**
   - Vercel's IPs are typically: `76.76.21.21` and `76.223.126.88`
   - But verify in Vercel Dashboard → Domains → Your domain

2. **Add A records in GoDaddy:**
   - Type: `A`
   - Name: `@`
   - Value: `76.76.21.21` (or the IP Vercel shows)
   - TTL: `600`
   - Save

3. **Add second A record** (if Vercel requires multiple IPs):
   - Type: `A`
   - Name: `@`
   - Value: `76.223.126.88` (or second IP from Vercel)
   - TTL: `600`
   - Save

4. **Add CNAME for www:**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com` (or what Vercel shows)
   - TTL: `600`
   - Save

## Quick Diagnostic Checklist

- [ ] Domain `provenance.guru` is added to Vercel project
- [ ] Vercel shows DNS records to use (check Settings → Domains)
- [ ] All old DNS records removed from GoDaddy
- [ ] New DNS records added exactly as Vercel shows
- [ ] Records saved in GoDaddy (no errors)
- [ ] Waited 5-10 minutes after saving
- [ ] Checked [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru) again

## Most Common Issue

**The #1 reason for all red X's**: The domain isn't actually added to Vercel, or the DNS records in GoDaddy don't match what Vercel expects.

**Solution**: 
1. Add domain to Vercel first
2. Use the EXACT DNS records Vercel shows you
3. Don't use generic/example records

## Next Steps

1. **First**: Verify domain is in Vercel (Settings → Domains)
2. **Second**: Copy the EXACT DNS records Vercel shows
3. **Third**: Remove all old records in GoDaddy
4. **Fourth**: Add the exact records Vercel shows
5. **Fifth**: Wait 10-15 minutes and check again

If it still doesn't work after following these steps exactly, there may be a GoDaddy plan limitation or Vercel configuration issue that requires support.
