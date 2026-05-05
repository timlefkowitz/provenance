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
  welcome: 'Welcome to Provenance!',
  certification: 'Your artwork "{{artworkTitle}}" has been certified',
  notification: 'Notification from Provenance',
  summary: 'Your Provenance activity summary',
  update: 'Update from Provenance',
  artwork_featured: 'Congratulations – Your Work Has Been Queued for Our Landing Page!',
  institution_thanks: 'Thank you from Provenance',
} as const;

export const DEFAULT_EMAIL_MARKDOWN = {
  welcome: `# Your art deserves a permanent record.

Hi {{name}},

You just joined a community of artists, collectors, and institutions building a new standard for authenticity.

Provenance gives every artwork a verifiable origin story that travels with it forever.

---

## What you can do now

- **Create certificates** that verify your work is genuine
- **Build your portfolio** with institutional-grade documentation  
- **Share provenance** with galleries, collectors, and the public

[Get Started]({{siteUrl}}/artworks/add)

We built Provenance because we believe every creator deserves tools that were previously only available to major institutions.

Welcome aboard.

The Provenance Team
`,

  certification: `# Certificate Issued

{{name}}, your artwork has been certified.

**"{{artworkTitle}}"** now has a permanent, verifiable record of authenticity on Provenance.

{{CERT_BLOCK}}

---

## What this means

Your certificate is cryptographically linked to your artwork record. Anyone can verify its authenticity, and it will remain part of the work's provenance history as it moves through collections and exhibitions.

[View Your Artwork]({{artworkUrl}})

Share this certificate with collectors, galleries, or include it in exhibition materials.

The Provenance Team
`,

  notification: `## {{title}}

Hi {{name}},

{{body}}

[{{ctaLabel}}]({{ctaUrl}})

---

Best regards,  
The Provenance Team
`,

  summary: `## Your {{periodLabel}}

Hi {{name}},

Here's what's been happening on Provenance:

{{ITEMS}}

[Open Portal]({{siteUrl}}/portal)

---

Best regards,  
The Provenance Team
`,

  update: `## {{title}}

Hi {{name}},

{{body}}

[{{ctaLabel}}]({{ctaUrl}})

---

Best regards,  
The Provenance Team
`,

  artwork_featured: `## Congratulations – Your Work Has Been Queued for Our Landing Page!

Dear {{artistName}},

We are thrilled to share some wonderful news: your artwork **"{{artworkTitle}}"** has been selected and is now queued to be featured on the Provenance landing page.

Our team personally reviews every piece that appears on the homepage, and yours stood out for its exceptional quality and provenance story. This is a remarkable achievement and a testament to the work you bring to the platform.

[View Your Artwork]({{artworkUrl}})

---

Thank you for being a part of the Provenance community.

Warm regards,  
**The Provenance Team**
`,

  institution_thanks: `# Thank you for your time.

Hi {{name}},

We really appreciate you taking the time to explore Provenance.

---

Building tools for institutions means understanding the real workflows of registrars, curators, and collections teams. Your perspective helps us get that right.

## A quick recap

Provenance brings certificates, provenance records, and collection operations into one unified system:

- **Certificates that stay in sync** with curatorial and legal records
- **Transparent event logging** for loans, acquisitions, and movements
- **Team workspaces** with role-based access

Everything is built to meet the accountability standards institutions need.

---

## We would love to hear from you

Your feedback directly shapes what we build next. If you have thoughts, questions, or suggestions, we are all ears.

[Share your feedback]({{feedbackUrl}})

[Learn more about Provenance for institutions]({{institutionUrl}})

Thanks again,

The Provenance Team
`,
} as const;

export type EmailTemplateKey = keyof typeof DEFAULT_EMAIL_MARKDOWN;
