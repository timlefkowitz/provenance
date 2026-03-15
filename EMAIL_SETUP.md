# Email Setup Guide

This application sends transactional emails via **[Resend](https://resend.com)** (free tier: 3,000 emails/month, 100/day, 1 custom domain).

## Features

- Welcome email when users sign up (including Google OAuth)
- Certification email when artworks are uploaded and certified
- Notification email (e.g. gallery invite)
- Summary email (e.g. activity summary)
- Update email (product/news updates)
- Custom HTML email templates in `src/lib/email.ts`

## Environment Variables

Add these to your `.env.local`:

```bash
# Resend (required for sending)
RESEND_API_KEY=re_xxxxxxxxxxxx    # From https://resend.com/api-keys
RESEND_FROM=Provenance <noreply@provenance.guru>   # Optional; defaults to Provenance <noreply@provenance.guru>

# API route auth (optional)
EMAIL_API_SECRET=your-secret-key-here

# Site URL (for links in emails)
NEXT_PUBLIC_SITE_URL=https://provenance.guru
```

## Domain verification (sending from your domain)

To send from `noreply@provenance.guru` (or `dev@provenance.guru`):

1. Sign up at [Resend](https://resend.com) and create an API key.
2. In the Resend dashboard, go to **Domains** and add `provenance.guru`.
3. Add the DNS records Resend shows (SPF, DKIM, etc.) at your DNS provider (e.g. Google Domains, Cloudflare).
4. Wait for verification. Then set `RESEND_FROM` to any address on that domain, e.g.:
   - `noreply@provenance.guru`
   - `Provenance <noreply@provenance.guru>`
   - `dev@provenance.guru`

Your Google Workspace addresses (e.g. dev@provenance.guru) are separate from Resend: Resend only needs the domain verified so it can send *from* that domain. You do not need to use Google’s SMTP.

- [Resend: Add and verify a domain](https://resend.com/docs/dashboard/domains/introduction)

## How it works

### Welcome emails

When a user signs up (including Google OAuth), the auth callback checks if the account was created in the last 2 minutes and sends a welcome email.

**Location:** `src/app/auth/callback/route.ts`

### Certification emails

When an artwork is uploaded and certified, the app sends an email with title, certificate number, and link to the artwork.

**Location:** `src/app/artworks/add/_actions/create-artwork.ts` (and batch variant)

### Other types

Notification, summary, and update emails use the same `~/lib/email` helpers and can be triggered via the API route below.

## Email templates

Templates are in `src/lib/email.ts`:

- Welcome, certification, notification, summary, update

Edit the HTML in those functions to change content or styling.

## API route

`POST /api/email/send` accepts a JSON body with `type`, `email`, and type-specific fields. Secure it with `Authorization: Bearer YOUR_EMAIL_API_SECRET` if `EMAIL_API_SECRET` is set.

Examples:

```typescript
// Welcome
await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_EMAIL_API_SECRET' },
  body: JSON.stringify({ type: 'welcome', email: 'user@example.com', userId: 'user-id', name: 'User Name' })
});

// Certification
await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_EMAIL_API_SECRET' },
  body: JSON.stringify({
    type: 'certification',
    email: 'user@example.com',
    userId: 'user-id',
    artworkTitle: 'Artwork Title',
    certificateNumber: 'PROV-ABC123',
    artworkUrl: 'https://provenance.guru/artworks/123'
  })
});

// Notification
await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_EMAIL_API_SECRET' },
  body: JSON.stringify({
    type: 'notification',
    email: 'user@example.com',
    subject: 'Title',
    title: 'Title',
    body: 'Body text.',
    ctaUrl: 'https://provenance.guru/portal',
    ctaLabel: 'View'
  })
});

// Summary
await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_EMAIL_API_SECRET' },
  body: JSON.stringify({
    type: 'summary',
    email: 'user@example.com',
    subject: 'Your weekly summary',
    items: [{ title: 'Item one', description: 'Optional' }, { title: 'Item two' }],
    period: 'This week'
  })
});

// Update
await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_EMAIL_API_SECRET' },
  body: JSON.stringify({
    type: 'update',
    email: 'user@example.com',
    subject: 'Product update',
    title: 'Update title',
    body: 'Update body.',
    link: 'https://provenance.guru/blog/update',
    linkLabel: 'Learn more'
  })
});
```

## Testing

1. Set `RESEND_API_KEY` (and optionally `RESEND_FROM`) in `.env.local`.
2. Verify your domain in Resend if you use a custom “from” address.
3. Sign up a new user or use Google OAuth and check for the welcome email.
4. Upload an artwork to trigger the certification email.

## Troubleshooting

### Emails not sending

- Ensure `RESEND_API_KEY` is set and valid (see [Resend API keys](https://resend.com/api-keys)).
- Check server logs for `[Email]` messages (send started, success, or error).
- If using a custom domain, ensure the domain is verified in the Resend dashboard.

### Emails go to spam

- Use a verified domain and the “from” address on that domain.
- Resend sets SPF/DKIM when the domain is verified; ensure those DNS records are in place.
- Avoid spammy wording in subject and body.

### Development vs production

- Use the same Resend API key in both, or separate keys per environment.
- Set `NEXT_PUBLIC_SITE_URL` to your production URL so links in emails point to the right site.
