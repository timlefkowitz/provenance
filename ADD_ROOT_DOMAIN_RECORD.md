# Add Root Domain DNS Record - Fix Missing @ Record

## Problem
Your GoDaddy DNS is missing a record for the root domain (`@`). You have:
- ✅ CNAME for `www` → `fb70d3fcdef1f921.vercel-dns-017.com.` (correct!)
- ❌ **Missing record for root domain `@`**

This is why `provenance.guru` doesn't resolve, but `www.provenance.guru` might work.

## Solution: Add A Record for Root Domain

### Step 1: Get Vercel's IP Address

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Domains**
4. Click on `provenance.guru`
5. Look for DNS configuration - it should show you an **A record with an IP address**

**If Vercel shows an IP address:**
- Use that exact IP address

**If Vercel doesn't show an IP (only shows CNAME):**
- Use these standard Vercel IP addresses:
  - `76.76.21.21`
  - `76.223.126.88`

### Step 2: Add A Record in GoDaddy

1. Log in to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products** → `provenance.guru` → **DNS**
3. Click **Add** (or **+** button)
4. Fill in:
   - **Type**: `A`
   - **Name**: `@` (or leave blank/empty - this means root domain)
   - **Data/Value**: `76.76.21.21` (or the IP Vercel shows you)
   - **TTL**: `1 Hour` (or `600`)
5. Click **Save**

### Step 3: Add Second A Record (Optional but Recommended)

Vercel often uses multiple IP addresses for redundancy. Add a second A record:

1. Click **Add** again
2. Fill in:
   - **Type**: `A`
   - **Name**: `@` (or leave blank)
   - **Data/Value**: `76.223.126.88` (or second IP from Vercel)
   - **TTL**: `1 Hour`
3. Click **Save**

### Step 4: Verify Your DNS Records

After adding, your DNS should look like:

```
Type    Name    Data/Value                                    TTL
A       @       76.76.21.21                                   1 Hour
A       @       76.223.126.88                                  1 Hour
CNAME   www     fb70d3fcdef1f921.vercel-dns-017.com.          12 Hours
```

### Step 5: Wait and Test

1. **Wait 10-15 minutes** for DNS to propagate
2. **Check DNS propagation**: [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru)
   - Should start showing green checkmarks
3. **Check Vercel status**: Settings → Domains → `provenance.guru`
   - Should show "Valid Configuration" or "Pending"
4. **Test domain**: Visit `https://provenance.guru`
   - Should load your Vercel app

## Alternative: If Vercel Shows CNAME/ALIAS for Root

If Vercel specifically shows a CNAME/ALIAS value for the root domain (not IP addresses):

**Note**: GoDaddy may not support CNAME/ALIAS for root domain on all plans. In that case, use A records instead (as shown above).

If your GoDaddy plan DOES support ALIAS for root:

1. Click **Add** in GoDaddy DNS
2. Fill in:
   - **Type**: `ALIAS` (if available) or `A`
   - **Name**: `@` (or leave blank)
   - **Data/Value**: [The CNAME value Vercel shows, e.g., `fb70d3fcdef1f921.vercel-dns-017.com.`]
   - **TTL**: `1 Hour`
3. Click **Save**

## Why This Fixes It

- **Before**: No record for `provenance.guru` → DNS lookup fails → red X's
- **After**: A record for `@` → DNS resolves to Vercel IP → green checkmarks

## Quick Checklist

- [ ] Added A record for `@` (root domain) in GoDaddy
- [ ] Used IP address from Vercel (or standard Vercel IPs: `76.76.21.21`, `76.223.126.88`)
- [ ] Saved the record
- [ ] Waited 10-15 minutes
- [ ] Checked [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru) - should show green checkmarks
- [ ] `https://provenance.guru` loads your app

## After DNS Works

Once `https://provenance.guru` loads:

1. **Update Supabase**:
   - Authentication → URL Configuration
   - Site URL: `https://provenance.guru` (no trailing slash)
   - Redirect URLs: `https://provenance.guru/auth/callback`

2. **Update Vercel Environment Variables**:
   - Settings → Environment Variables
   - `NEXT_PUBLIC_SITE_URL=https://provenance.guru`
   - Redeploy

3. **Test OAuth** - should now work!
