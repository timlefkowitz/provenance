# Creator websites

Every artist and gallery can publish a personal microsite on Provenance — no separate hosting required.

## Getting started

1. Go to **Website Editor** (`/profile/site`) from the Toolbox menu.
2. Choose a **handle** (e.g. `jane-doe` → `jane-doe.provenance.guru`).
3. Pick a **template** (Editorial, Folio, and others).
4. Customize content blocks, colors, and featured works.
5. Click **Publish**.

## Live URL

Published sites are available at:

```
https://{handle}.provenance.guru
```

Provenance middleware automatically routes subdomain requests to your site.

## Site pages

Each creator site includes:

| Page | URL |
|------|-----|
| Home | `/` |
| Works | `/works/[artworkId]` |
| Exhibitions | `/exhibitions/[id]` |
| Contact | `/contact` |

## Custom domains

Connect your own domain (e.g. `janedoe.art`) from the website editor:

1. Enter your domain in the custom domain settings.
2. Add the DNS records Provenance provides.
3. Complete checkout for domain verification (Stripe).
4. Once verified, your site serves on your custom domain.

## Preview mode

Preview your site before publishing at `/profile/site/preview`. Preview renders full-screen without the main navigation.

## Templates

Templates live in `src/app/_sites/_templates/`. Each template defines layout, typography, and how artworks and exhibitions are displayed. Switch templates anytime from the editor — republish to apply changes.
