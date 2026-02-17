# Verify DNS Setup for provenance.guru

## Your Current DNS Configuration

Based on your GoDaddy DNS records, you have:
- ✅ ALIAS record for root domain (`*`) → `cname.vercel-dns-017.com.`
- ✅ ALIAS record (likely for www) → `cname.vercel-dns-017.com.`
- ✅ CAA record for Let's Encrypt SSL

This configuration looks **correct** for Vercel!

## Next Steps to Verify

### 1. Check if Domain is Added to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Domains**
4. Verify `provenance.guru` is listed
5. Check the status:
   - ✅ **Valid Configuration** = Everything is working
   - ⚠️ **Invalid Configuration** = Something needs fixing
   - ⏳ **Pending** = Still waiting for DNS/SSL

### 2. Check DNS Propagation

Your DNS records are set up correctly, but they need to propagate globally. This can take:
- **5-60 minutes** (most common)
- **Up to 24-48 hours** (rare)

**Check propagation status:**
- Visit: [whatsmydns.net - provenance.guru](https://www.whatsmydns.net/#A/provenance.guru)
- Look for green checkmarks across different locations
- If you see red X's, DNS hasn't propagated to those locations yet

### 3. Test Domain Access

Once DNS has propagated:

1. **Test HTTP:**
   ```bash
   curl -I http://provenance.guru
   ```
   Should return a 301 redirect to HTTPS

2. **Test HTTPS:**
   ```bash
   curl -I https://provenance.guru
   ```
   Should return `200 OK` or `301/302` redirect

3. **Visit in browser:**
   - Go to `https://provenance.guru`
   - Should load your Vercel app
   - Check for SSL padlock icon

### 4. If Domain Still Doesn't Work

**If you still get "Safari can't find the server":**

1. **Verify domain is in Vercel:**
   - Settings → Domains
   - Must see `provenance.guru` listed
   - If not listed, add it

2. **Check DNS propagation:**
   - Use [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru)
   - If most locations show errors, DNS hasn't propagated yet
   - Wait longer (can take up to 48 hours)

3. **Clear local DNS cache:**
   ```bash
   # macOS
   sudo dscacheutil -flushcache
   sudo killall -HUP mDNSResponder
   
   # Or restart your router
   ```

4. **Check Vercel domain status:**
   - If it shows "Invalid Configuration", there might be a mismatch
   - If it shows "Pending", wait for SSL certificate (5-10 minutes after DNS)

5. **Try different network:**
   - Use mobile data instead of WiFi
   - Or use a VPN to test from different location

### 5. Once Domain Works

After `https://provenance.guru` loads your app:

1. **Update Supabase:**
   - Authentication → URL Configuration
   - Site URL: `https://provenance.guru` (no trailing slash)
   - Redirect URLs: `https://provenance.guru/auth/callback`

2. **Update Vercel Environment Variables:**
   - Settings → Environment Variables
   - `NEXT_PUBLIC_SITE_URL=https://provenance.guru`
   - Redeploy

3. **Test OAuth:**
   - Should now redirect correctly to `/auth/callback`

## Common Issues

### Issue: DNS Records Look Correct But Domain Doesn't Resolve

**Possible causes:**
- DNS hasn't propagated yet (most common)
- Domain not added to Vercel project
- Wrong Vercel project
- Local DNS cache

**Fix:**
- Wait 5-60 minutes for propagation
- Verify domain is in Vercel
- Clear DNS cache
- Check [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru)

### Issue: Domain Resolves But Shows Error Page

**Possible causes:**
- Domain added to wrong Vercel project
- Project not deployed
- SSL certificate not issued yet

**Fix:**
- Verify domain is in correct Vercel project
- Check project has active deployments
- Wait 5-10 minutes for SSL certificate

## Quick Checklist

- [ ] Domain `provenance.guru` is added to Vercel project
- [ ] Vercel shows "Valid Configuration" or "Pending" (not "Invalid")
- [ ] DNS records in GoDaddy match what's shown above
- [ ] DNS has propagated (check [whatsmydns.net](https://www.whatsmydns.net/#A/provenance.guru))
- [ ] `https://provenance.guru` loads your app (not an error)
- [ ] SSL certificate is active (padlock icon)
- [ ] Supabase Site URL is set to `https://provenance.guru`
- [ ] Supabase Redirect URLs includes `https://provenance.guru/auth/callback`
