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
} as const;

export const DEFAULT_EMAIL_MARKDOWN = {
  welcome: `## Welcome to Provenance!

Hi {{name}},

Thank you for joining Provenance! We're excited to have you as part of our community of artists and collectors.

With Provenance, you can:

- Create and manage your artwork portfolio
- Generate digital certificates of authenticity
- Track the provenance of your pieces
- Connect with collectors and other artists

[Get Started]({{siteUrl}}/artworks/add)

---

If you have any questions, feel free to reach out to us. We're here to help!

Best regards,  
The Provenance Team
`,

  certification: `## Your Artwork Has Been Certified! 🎨

Hi {{name}},

Great news! Your artwork **"{{artworkTitle}}"** has been successfully uploaded and certified on Provenance.

{{CERT_BLOCK}}

Your digital certificate of authenticity has been generated and is now part of the permanent record on Provenance. This certificate helps establish the provenance and authenticity of your artwork.

[View Your Artwork]({{artworkUrl}})

---

You can share this certificate with collectors, galleries, or anyone interested in verifying the authenticity of your work.

Best regards,  
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
} as const;

export type EmailTemplateKey = keyof typeof DEFAULT_EMAIL_MARKDOWN;
