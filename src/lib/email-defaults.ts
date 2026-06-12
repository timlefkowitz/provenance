/**
 * Default markdown + subjects when DB tables are empty or rows missing.
 * Placeholders: {{name}}, {{siteUrl}}, {{artworkTitle}}, {{certificateNumber}}, {{artworkUrl}},
 * {{CERT_BLOCK}}, {{title}}, {{body}}, {{ctaUrl}}, {{ctaLabel}}, {{periodLabel}}, {{ITEMS}}
 */

export interface SummaryItem {
  title: string;
  description?: string;
}

export const DEFAULT_EMAIL_SUBJECTS = {
  welcome: 'Welcome to Provenance',
  certification: 'Your artwork "{{artworkTitle}}" has been certified',
  notification: 'Notification from Provenance',
  summary: 'Your Provenance activity summary',
  update: 'Update from Provenance',
  artwork_featured: 'Your work is queued for the Provenance landing page',
  institution_thanks: 'Thank you from Provenance',
} as const;

export const DEFAULT_EMAIL_MARKDOWN = {
  welcome: `## Welcome to Provenance

Hi {{name}},

Thanks for joining Provenance. You can document your work, issue certificates, and share provenance with collectors and institutions.

- Build and manage your artwork portfolio
- Generate certificates of authenticity
- Track provenance over time
- Connect with collectors and artists

[Get started]({{siteUrl}}/artworks/add)

---

Questions? Reply to this email — we're happy to help.

Best,  
The Provenance team
`,

  certification: `## Your artwork has been certified

Hi {{name}},

**"{{artworkTitle}}"** is now certified on Provenance.

{{CERT_BLOCK}}

Your certificate is part of the permanent record on Provenance and can be shared with collectors, galleries, or anyone verifying authenticity.

[View artwork]({{artworkUrl}})

---

Best,  
The Provenance team
`,

  notification: `## {{title}}

Hi {{name}},

{{body}}

[{{ctaLabel}}]({{ctaUrl}})

---

Best,  
The Provenance team
`,

  summary: `## Your {{periodLabel}}

Hi {{name}},

Here's what's been happening on Provenance:

{{ITEMS}}

[Open portal]({{siteUrl}}/portal)

---

Best,  
The Provenance team
`,

  update: `## {{title}}

Hi {{name}},

{{body}}

[{{ctaLabel}}]({{ctaUrl}})

---

Best,  
The Provenance team
`,

  artwork_featured: `## Your work is queued for our landing page

Dear {{artistName}},

**"{{artworkTitle}}"** has been selected and queued to appear on the Provenance landing page.

Our team reviews every featured work — yours stood out for quality and provenance.

[View artwork]({{artworkUrl}})

---

Thank you for being part of Provenance.

Best,  
The Provenance team
`,

  institution_thanks: `## Thank you for your time

Hi {{name}},

We appreciate you exploring what Provenance offers institutions — from a unified certificate registry to the operations tools registrars use every day.

---

## One registry: authenticity, ownership, and intermediary in sync

Certificates of authenticity, ownership, and intermediary share the same underlying record — so curatorial narrative, legal title, and market handoffs stay aligned. Provenance transfers with a structured handoff: counterparties review the package and accept with one click.

- **Certificate of authenticity** — Artist-anchored authenticity that travels with the object.
- **Certificate of ownership** — Clear title and custodial context for acquisitions and donors.
- **Certificate of intermediary** — Dealers, lenders, and registrars document handoffs without fragmenting the record.

**One-click accept for provenance transfers.** Bundle condition, certificates, and event history into a single transfer. The receiving institution or collector confirms in one action.

---

## Built for registrars

- **Provenance-first** — Accession, location, and exhibition history stay tied to the same certificate graph.
- **One source of truth** — Curatorial, registrar, and development views pull from shared records.
- **Append-only events** — Custody changes emit transparent records instead of silent edits.
- **Built for public trust** — Verification-friendly certificates and APIs for partners.

---

## From catalog to contracts

- **Invoicing** — Create and send invoices from your collection.
- **Loan agreements** — Generate and manage loan agreements with digital signatures.
- **Label maker** — Print-ready labels with QR codes linking to certificates.
- **Exhibitions checklist** — Coordinate install, condition checks, and sign-offs.
- **Cataloging & provenance** — Full accessioning, provenance tracking, and location management.
- **Team accounts** — Role-aware access for registrars, curators, and operations staff.

---

## Early proof & previews

- **Event ledger** — Public read on asset_events; authenticated inserts only.
- **Certificates table** — Unified registry across art, collectibles, vehicles, and real property.
- **API surface** — Key management in-database; HTTP verification routes on your timeline.

---

## What registrars are telling us

> "We are evaluating Provenance where our TMS ends and public trust begins — especially for traveling exhibitions."
>
> *— Registrar office, permission pending*

---

## Frequently asked questions

**How do certificates work together?**  
They share the same registry-backed record so authenticity, title, and handoff context stay aligned.

**What does append-only event logging give our team?**  
Each custody or movement change emits a transparent record with actor, payload, and timestamp.

**How mature is the HTTP verification API?**  
API key storage, scopes, and rate limits exist today; wire your edge layer when ready.

---

## Built for boards, donors, and partner scrutiny

- **Append-only event ledger** — History cannot be silently overwritten.
- **Scoped API keys** — Partner verification exposes only what you configure.
- **Encryption in transit and at rest** — TLS and encrypted storage.
- **Role-aware team access** — Individual accounts tied to your institution workspace.

---

## Next steps

Subscribe to align your team on a registry-shaped record that scales from accessioning to partner verification.

We would love your feedback — it shapes what we build next.

[Share your feedback]({{feedbackUrl}})

[Visit the institution page]({{institutionUrl}})
`,
} as const;

export type EmailTemplateKey = keyof typeof DEFAULT_EMAIL_MARKDOWN;
