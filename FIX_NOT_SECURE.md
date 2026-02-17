# Fix "This Page Isn't Secure" / "Proceed Anyway" on provenance.guru

When the browser says **this page isn't secure** or asks you to **proceed anyway**, it usually means:

1. **You're on HTTP** – The site is loading over `http://` instead of `https://`.
2. **No SSL certificate yet** – Vercel hasn't been able to issue an HTTPS certificate (often because of DNS or CAA).
3. **App is generating HTTP links** – e.g. `NEXT_PUBLIC_SITE_URL` is wrong in Vercel.

Use the checklist below so the site is always served over HTTPS with a valid certificate.

---

## 1. DNS in GoDaddy (you already did this)

- **Apex:** one **A** record: **Name** `@` → **Value** `76.76.21.21`
- **www:** one **CNAME**: **Name** `www` → **Value** `cname.vercel-dns.com`
- **No extra records** for the apex (no duplicate A, AAAA, or CNAME for `@`)

---

## 2. CAA record (required for Let's Encrypt)

Vercel uses Let's Encrypt. If you have **any** CAA records, one **must** allow Let's Encrypt or the certificate will never be issued.

In GoDaddy DNS, ensure you have:

| Type | Name | Value           | TTL   |
|------|------|-----------------|-------|
| CAA  | `@`  | `0 issue "letsencrypt.org"` | 600 or default |

- If you have other CAA records (e.g. `0 issue "digicert.com"`), either **add** the Let's Encrypt one above or remove CAA records that block other CAs (depending on your policy).
- **No CAA at all** is also fine (no restriction = Let's Encrypt can issue).

---

## 3. Domain in Vercel

1. [Vercel Dashboard](https://vercel.com/dashboard) → your project → **Settings** → **Domains**.
2. **provenance.guru** and **www.provenance.guru** should be listed.
3. Status for **provenance.guru** must be **Valid Configuration**. If it says **Invalid Configuration**, Vercel will show what's wrong (fix DNS/CAA first).
4. Optional: click the domain → **Refresh** to re-run DNS check and trigger certificate issuance.

---

## 4. Don't block certificate validation

- **Do not** redirect or rewrite the `/.well-known` path (Vercel needs it for Let's Encrypt HTTP-01). If you add a `vercel.json` or middleware, leave `/.well-known` untouched.

---

## 5. Environment variable in Vercel

So the app never builds or redirects to HTTP:

- In Vercel: **Settings** → **Environment Variables**
- Set **NEXT_PUBLIC_SITE_URL** = **`https://provenance.guru`** (with `https://`, no trailing slash)
- Redeploy after changing so the new value is used.

---

## 6. Wait for the certificate

After DNS (and CAA) are correct and Vercel shows **Valid Configuration**:

- Certificate issuance usually takes **a few minutes** (up to ~1 hour in some cases).
- Avoid changing DNS again during this time.
- Then open **https://provenance.guru** (and **https://www.provenance.guru**) and check for the padlock.

---

## 7. Use HTTPS and clear cache

- Always open **https://provenance.guru** (not `http://`). Update bookmarks to `https://`.
- If it still shows "not secure": hard refresh (**Cmd+Shift+R** / **Ctrl+Shift+R**) or try an incognito/private window.

---

## Quick checklist (so you don't get "proceed anyway")

- [ ] GoDaddy: one A record `@` → `76.76.21.21`; one CNAME `www` → `cname.vercel-dns.com`; no duplicate apex records.
- [ ] GoDaddy: if you use CAA, `0 issue "letsencrypt.org"` exists for `@`.
- [ ] Vercel **Settings → Domains**: **provenance.guru** status is **Valid Configuration**.
- [ ] Vercel **Settings → Environment Variables**: **NEXT_PUBLIC_SITE_URL** = **https://provenance.guru**.
- [ ] No redirect/rewrite of `/.well-known` (e.g. in `vercel.json` or middleware).
- [ ] Waited 10–30 minutes (or up to ~1 hour) after fixing DNS/CAA.
- [ ] You open **https://provenance.guru** and refreshed or tried in a private window.

Once all of the above are done, Vercel serves the site over HTTPS with a valid certificate and the "not secure" / "proceed anyway" message should go away.
