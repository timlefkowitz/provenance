# Fix "This Page Isn't Secure" on provenance.guru

When the browser says **this page isn't secure**, it usually means either:

1. **You're on HTTP** – The site is loading over `http://` instead of `https://`.
2. **No SSL certificate yet** – Vercel hasn’t been able to issue an HTTPS certificate for your domain (often because of DNS).

Follow these steps.

---

## Step 1: Use HTTPS in the address bar

- Open **`https://provenance.guru`** (with `https://`), not `http://provenance.guru`.
- If you use a bookmark, update it to `https://`.

If **only** HTTP was the issue, the padlock should appear when you use `https://`.

---

## Step 2: Check the domain in Vercel

Vercel automatically issues an SSL certificate (via Let’s Encrypt) **after** the domain is added and DNS is correct. If DNS is wrong or not propagated, the certificate is never issued and the site can show “not secure.”

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → your project.
2. Open **Settings** → **Domains**.
3. Find **provenance.guru** and check the status:
   - **Valid Configuration** – DNS is correct; SSL should be issued (or in progress).
   - **Invalid Configuration** – Vercel will show what’s wrong (e.g. missing or wrong DNS records). Fix those first.

---

## Step 3: Fix DNS (if Vercel says Invalid Configuration)

1. In Vercel, click **provenance.guru** and copy the **exact** DNS records it shows.
2. In **GoDaddy**: My Products → **provenance.guru** → **DNS** (Manage DNS).
3. Ensure you have the records Vercel asks for, for example:
   - **Root (provenance.guru):**  
     - Either an **A** record pointing to Vercel’s IP (e.g. `76.76.21.21`),  
     - Or an **ALIAS** record if your registrar supports it (value from Vercel).
   - **www:**  
     - **CNAME** record: `www` → value Vercel gives (e.g. `cname.vercel-dns.com`).
4. Save and wait **10–30 minutes** (up to 48 hours in rare cases). Recheck **Settings → Domains** in Vercel until it shows **Valid Configuration**.

Details and alternatives (e.g. if GoDaddy doesn’t support ALIAS) are in **FIX_DNS_RED_X.md** and **ADD_ROOT_DOMAIN_RECORD.md**.

---

## Step 4: Allow Let’s Encrypt (CAA records)

If you added **CAA** records for your domain, they must allow Let’s Encrypt, or Vercel can’t get a certificate.

In GoDaddy DNS, add (or keep) a CAA record:

- **Type:** `CAA`
- **Name:** `@` (or blank for root)
- **Value:** `0 issue "letsencrypt.org"`
- **TTL:** 600 (or default)

Save and wait for DNS to update, then recheck the domain in Vercel.

---

## Step 5: Wait for the certificate

After DNS shows **Valid Configuration** in Vercel:

- Certificate issuance can take a few minutes (sometimes up to an hour).
- Don’t change DNS again during this time.
- Visit **https://provenance.guru** again; the padlock should appear once the cert is active.

---

## Step 6: Clear cache and retry

- Hard refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac).
- Or try an incognito/private window.
- Make sure you’re on **https://provenance.guru**.

---

## Quick checklist

- [ ] You’re opening **https://provenance.guru** (not http).
- [ ] **provenance.guru** is added in Vercel (Settings → Domains).
- [ ] Domain status in Vercel is **Valid Configuration** (DNS matches what Vercel shows).
- [ ] If you use CAA records, `0 issue "letsencrypt.org"` is present.
- [ ] You’ve waited at least 10–30 minutes after fixing DNS.
- [ ] You’ve refreshed or tried in a private window.

Once DNS is valid and the certificate is issued, Vercel serves the site over HTTPS and the “not secure” warning should go away.
