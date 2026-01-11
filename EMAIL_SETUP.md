# Email Setup Guide

This application uses a custom email solution built with **nodemailer** for sending transactional emails. This gives you full control over your email infrastructure without relying on third-party services like Resend.

## Features

- ✅ Welcome email when users sign up (including Google OAuth)
- ✅ Certification email when artworks are uploaded and certified
- ✅ Custom email templates with HTML styling
- ✅ SMTP-based email delivery (works with any SMTP provider)

## Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com          # Your SMTP server hostname
SMTP_PORT=587                     # SMTP port (587 for TLS, 465 for SSL)
SMTP_SECURE=false                 # true for SSL (port 465), false for TLS (port 587)
SMTP_USER=your-email@gmail.com     # Your SMTP username/email
SMTP_PASSWORD=your-app-password    # Your SMTP password or app-specific password
SMTP_FROM=noreply@provenance.app  # From email address (optional, defaults to SMTP_USER)

# Email API Secret (optional, for securing the API route)
EMAIL_API_SECRET=your-secret-key-here

# Site URL (for email links)
NEXT_PUBLIC_SITE_URL=https://provenance.app  # Your production URL
```

## SMTP Provider Options

### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Use an App Password, not your regular password
```

**Note:** For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an "App Password" in your Google Account settings
3. Use that App Password as `SMTP_PASSWORD`

### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

### Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

### AWS SES
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Use your region
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

### Custom SMTP Server
Any SMTP server that supports standard SMTP authentication will work. Just configure the host, port, and credentials accordingly.

## How It Works

### Welcome Emails
When a user signs up (including via Google OAuth), the auth callback route checks if the account was created in the last 2 minutes. If so, it automatically sends a welcome email.

**Location:** `src/app/auth/callback/route.ts`

### Certification Emails
When an artwork is successfully uploaded and certified, the system automatically sends an email to the user with:
- Artwork title
- Certificate number
- Link to view the artwork

**Location:** `src/app/artworks/add/_actions/create-artwork.ts` and `create-artworks-batch.ts`

## Email Templates

Email templates are defined in `src/lib/email.ts`:
- `getWelcomeEmailTemplate()` - Welcome email for new users
- `getCertificationEmailTemplate()` - Certification email for new artworks

You can customize these templates by editing the HTML in the functions.

## API Route

There's also an API route at `/api/email/send` that can be called programmatically:

```typescript
// Send welcome email
await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_EMAIL_API_SECRET'
  },
  body: JSON.stringify({
    type: 'welcome',
    email: 'user@example.com',
    userId: 'user-id',
    name: 'User Name'
  })
});

// Send certification email
await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_EMAIL_API_SECRET'
  },
  body: JSON.stringify({
    type: 'certification',
    email: 'user@example.com',
    userId: 'user-id',
    artworkTitle: 'Artwork Title',
    certificateNumber: 'PROV-ABC123',
    artworkUrl: 'https://provenance.app/artworks/123'
  })
});
```

## Testing

To test emails locally:

1. Set up your SMTP credentials in `.env.local`
2. Sign up a new user (or use Google OAuth)
3. Check your email inbox for the welcome email
4. Upload an artwork to trigger the certification email

## Troubleshooting

### Emails not sending
1. Check that all SMTP environment variables are set correctly
2. Verify your SMTP credentials are correct
3. Check server logs for error messages
4. For Gmail, make sure you're using an App Password, not your regular password
5. Some SMTP providers require you to verify your "from" email address first

### Email goes to spam
- Make sure your `SMTP_FROM` domain matches your sending domain
- Set up SPF, DKIM, and DMARC records for your domain
- Use a reputable SMTP provider (SendGrid, Mailgun, AWS SES)
- Avoid spam trigger words in email content

### Development vs Production
- In development, use a test SMTP server or your personal email
- In production, use a professional SMTP service (SendGrid, Mailgun, AWS SES)
- Make sure to set `NEXT_PUBLIC_SITE_URL` to your production URL

## Alternative: Using Resend

If you prefer to use Resend instead of the custom SMTP solution:

1. Install Resend: `pnpm add resend`
2. Replace the email sending logic in `src/lib/email.ts` with Resend's API
3. Set `RESEND_API_KEY` environment variable

The current implementation is designed to be easily replaceable if you want to switch to Resend or another service later.

