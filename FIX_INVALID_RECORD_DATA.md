# Fix "Invalid Record Data" Error in GoDaddy

## Problem
Getting "record data is invalid" error when trying to add A record in GoDaddy.

## Common Causes & Solutions

### Issue 1: IP Address Format

**Make sure the IP address is:**
- ✅ Exactly 4 numbers separated by dots (e.g., `76.76.21.21`)
- ✅ No spaces before or after
- ✅ No trailing dots
- ✅ Valid IPv4 format

**Wrong formats:**
- ❌ `76.76.21.21.` (trailing dot)
- ❌ ` 76.76.21.21` (leading space)
- ❌ `76.76.21.21 ` (trailing space)
- ❌ `76.76.21` (missing octet)

### Issue 2: Name Field

**For root domain, the Name field should be:**
- ✅ `@` (at symbol)
- ✅ Or leave it **completely blank/empty**
- ✅ NOT `provenance.guru`
- ✅ NOT `*`

**Try both:**
1. First try: Name = `@`
2. If that doesn't work: Name = (leave blank/empty)

### Issue 3: Conflicting Records

**Check if you already have:**
- An A record for `@`
- An ALIAS record for `@`
- Any other record for root domain

**Solution:**
- Delete any existing A or ALIAS records for `@` first
- Then add the new one

### Issue 4: Wrong Record Type

**Make sure you're adding:**
- Type: `A` (not `AAAA`, not `CNAME`, not `ALIAS`)

### Issue 5: GoDaddy Interface Issues

**Try these steps:**
1. **Refresh the page** and try again
2. **Clear browser cache** and try again
3. **Use a different browser** (Chrome, Firefox, Safari)
4. **Try the mobile app** if available

## Step-by-Step Fix

### Step 1: Verify IP Address

**Get the correct IP from Vercel:**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Settings → Domains → `provenance.guru`
3. Look for the DNS configuration
4. Note the exact IP address shown

**Or use standard Vercel IPs:**
- `76.76.21.21`
- `76.223.126.88`

### Step 2: Check Existing Records

1. In GoDaddy DNS, look for any existing:
   - A records with Name = `@` or blank
   - ALIAS records with Name = `@` or blank
2. **Delete them first** if they exist
3. Wait 2-3 minutes

### Step 3: Add A Record (Try Method 1)

1. Click **Add** in GoDaddy DNS
2. Fill in:
   - **Type**: `A`
   - **Name**: `@` (type the @ symbol)
   - **Data/Value**: `76.76.21.21` (type carefully, no spaces)
   - **TTL**: `1 Hour` or `600`
3. Click **Save**

### Step 4: If Method 1 Doesn't Work (Try Method 2)

1. Click **Add** in GoDaddy DNS
2. Fill in:
   - **Type**: `A`
   - **Name**: (leave completely blank/empty - don't type anything)
   - **Data/Value**: `76.76.21.21`
   - **TTL**: `1 Hour`
3. Click **Save**

### Step 5: If Still Doesn't Work (Alternative)

**Try using GoDaddy's DNS management interface differently:**

1. Look for a **"Quick Add"** or **"Add Record"** button
2. Some GoDaddy interfaces have a dropdown - make sure you select `A` record
3. Try the **"Advanced DNS"** section if available

## Alternative: Use GoDaddy Support

If none of the above work:

1. **Contact GoDaddy Support**:
   - They can add the record for you
   - They can verify if there's a plan limitation
   - They can check for account-specific issues

2. **Ask them to add:**
   - Type: A
   - Name: @ (root domain)
   - Value: 76.76.21.21 (or IP from Vercel)
   - TTL: 1 Hour

## Verify the Record

After successfully adding:

1. **Check your DNS records** - should see:
   ```
   Type: A
   Name: @ (or blank)
   Data: 76.76.21.21
   ```

2. **Wait 10-15 minutes**

3. **Test**: [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru)

## What to Check

When you get the error, verify:

- [ ] IP address is exactly `76.76.21.21` (no spaces, no dots at end)
- [ ] Name field is `@` or completely blank
- [ ] Type is `A` (not AAAA or other)
- [ ] No existing A/ALIAS record for `@` (delete first if exists)
- [ ] TTL is set (1 Hour or 600)

## Still Not Working?

**Screenshot the error message** and:
1. Note exactly what you entered in each field
2. Check if there are any existing records for `@`
3. Try contacting GoDaddy support with the screenshot

The error message might give more clues - what does the exact error say?
