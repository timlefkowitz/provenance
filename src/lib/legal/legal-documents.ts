import type { LegalDocumentId } from './legal.config';
import { LEGAL_CONFIG } from './legal.config';

export type LegalSection = {
  heading?: string;
  paragraphs: string[];
};

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  disclaimer: string;
  sections: LegalSection[];
};

const { entityName, contactEmail, siteUrl, lastUpdated } = LEGAL_CONFIG;

function doc(id: LegalDocumentId, title: string, sections: LegalSection[]): LegalDocument {
  return {
    id,
    title,
    disclaimer:
      'This document is provided for informational purposes. Obtain qualified legal review before relying on it in production.',
    sections,
  };
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  privacy: doc('privacy', 'Privacy Policy', [
    {
      paragraphs: [
        `Last updated: ${lastUpdated}`,
        `${entityName} ("we," "us," or "our") operates ${siteUrl} and related services, including creator websites on subdomains, certificates of authenticity, and subscription features. This Privacy Policy explains how we collect, use, and share personal information when you use our platform.`,
      ],
    },
    {
      heading: 'Information we collect',
      paragraphs: [
        'Account information: email address, password (hashed), username, and profile details you provide (name, bio, location, website, medium, profile photo).',
        'Authentication data: if you sign in with Google OAuth, we receive basic profile information from Google as permitted by your Google account settings.',
        'Content you upload: artwork images, titles, provenance records, exhibition details, press links, CVs, and other materials you submit to the platform.',
        'Creator site data: handle, template choices, hero images, logos, taglines, and section visibility settings for your public artist or gallery website.',
        'Billing information: subscription role, plan interval, and payment status. Payment card details are processed by Stripe; we do not store full card numbers on our servers.',
        'Usage and analytics: pages visited, features used, referral data, and advertising performance metrics collected via Google Tag Manager and related analytics tools, subject to your cookie consent choices.',
        'Technical data: IP address, browser type, device information, cookies, and localStorage entries (including language, theme, and consent preferences).',
      ],
    },
    {
      heading: 'How we use information',
      paragraphs: [
        'Provide and operate the platform, including certificates, registries, exhibitions, operations tools, and creator websites.',
        'Authenticate users, prevent fraud, and enforce our Terms of Service.',
        'Process subscriptions and trials through Stripe.',
        'Send transactional emails (welcome messages, notifications, billing confirmations).',
        'Measure and improve product performance, including ad and analytics measurement where you have consented.',
        'Comply with legal obligations and respond to lawful requests.',
      ],
    },
    {
      heading: 'How we share information',
      paragraphs: [
        'Service providers: we use Supabase (database and authentication), Stripe (payments), Vercel (hosting), Google (OAuth and analytics/tag management), and email delivery providers to operate the service. These providers process data on our behalf under their own terms and privacy policies.',
        'Public content: artwork, profiles, exhibitions, and published creator sites may be visible to other users and the public according to your visibility and publish settings.',
        'Legal requirements: we may disclose information if required by law, court order, or to protect the rights, safety, and security of our users and the platform.',
        'We do not sell your personal information for money. Where applicable law defines "sale" or "sharing" to include certain analytics or advertising uses, you may contact us to exercise opt-out rights.',
      ],
    },
    {
      heading: 'Cookies and similar technologies',
      paragraphs: [
        'We use essential cookies for authentication, security, and site functionality. Non-essential analytics and advertising cookies are used only after you accept them via our cookie consent banner. See our Cookie Policy for details.',
      ],
    },
    {
      heading: 'Data retention',
      paragraphs: [
        'We retain account and content data while your account is active and as needed to provide the service. You may delete content or request account deletion subject to technical and legal retention requirements (e.g. billing records, fraud prevention, dispute resolution).',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Depending on your location, you may have rights to access, correct, delete, or export your personal data, object to or restrict certain processing, and withdraw consent for cookies/analytics.',
        `To exercise these rights, contact us at ${contactEmail}. We will respond within the timeframes required by applicable law.`,
      ],
    },
    {
      heading: 'International transfers',
      paragraphs: [
        'We may process and store information in the United States and other countries where our service providers operate. We take steps designed to protect your information consistent with this policy and applicable law.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'Our services are not directed to children under 13 (or 16 in certain jurisdictions). We do not knowingly collect personal information from children. Contact us if you believe a child has provided us data.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update this Privacy Policy from time to time. We will post the revised version with an updated "Last updated" date. Continued use after changes constitutes acceptance of the updated policy where permitted by law.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `${entityName}`,
        `Email: ${contactEmail}`,
        `Website: ${siteUrl}`,
      ],
    },
  ]),

  cookies: doc('cookies', 'Cookie Policy', [
    {
      paragraphs: [
        `Last updated: ${lastUpdated}`,
        `This Cookie Policy explains how ${entityName} uses cookies and similar technologies on ${siteUrl}.`,
      ],
    },
    {
      heading: 'What are cookies?',
      paragraphs: [
        'Cookies are small text files stored on your device. We also use localStorage for some preferences (e.g. cookie consent choice, language, theme).',
      ],
    },
    {
      heading: 'Essential cookies',
      paragraphs: [
        'Authentication and session cookies keep you signed in and secure your account.',
        'Functional cookies remember preferences such as language (lang), theme, and active profile perspective.',
        'These cookies are necessary for core site operation and do not require consent in many jurisdictions.',
      ],
    },
    {
      heading: 'Analytics and advertising cookies',
      paragraphs: [
        'With your consent, we use Google Tag Manager and related tags to measure site usage, ad performance, and conversion events (e.g. sign-up, trial start).',
        'If you click Decline on our cookie banner, we configure Google Consent Mode to deny analytics and advertising storage until you change your choice.',
        'If you click Accept, we grant consent for analytics and advertising cookies as described in the banner.',
      ],
    },
    {
      heading: 'Managing your choices',
      paragraphs: [
        'Use the Accept or Decline buttons on our cookie consent banner when you first visit the site.',
        'To withdraw consent later, clear site data/localStorage for this domain in your browser settings, or contact us at ' + contactEmail + '.',
        'You can also configure your browser to block cookies; some features may not work correctly if essential cookies are blocked.',
      ],
    },
    {
      heading: 'Third-party cookies',
      paragraphs: [
        'Stripe checkout may set cookies during payment. Google Sign-In may set cookies when you authenticate with Google. These providers control their own cookies under their respective policies.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `Questions about cookies: ${contactEmail}`,
      ],
    },
  ]),

  terms: doc('terms', 'Terms of Service', [
    {
      paragraphs: [
        `Last updated: ${lastUpdated}`,
        `These Terms of Service ("Terms") govern your access to and use of ${siteUrl} and related services operated by ${entityName}. By creating an account or using the platform, you agree to these Terms.`,
      ],
    },
    {
      heading: 'Eligibility',
      paragraphs: [
        'You must be at least 18 years old (or the age of majority in your jurisdiction) to use the service. You represent that the information you provide is accurate and that you have authority to bind any organization you represent.',
      ],
    },
    {
      heading: 'Accounts',
      paragraphs: [
        'You are responsible for safeguarding your login credentials and for activity under your account.',
        'You may maintain multiple profiles (e.g. artist, collector, gallery) according to platform rules. You must not impersonate others or create accounts for abusive or fraudulent purposes.',
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'You retain ownership of content you upload. You grant us a non-exclusive, worldwide license to host, display, reproduce, and distribute your content solely to operate and promote the platform, including on public profiles, registries, exhibitions, and published creator sites you enable.',
        'You represent that you have the rights to upload and share your content and that it does not infringe third-party intellectual property, privacy, or other rights.',
        'We may remove content that violates these Terms or applicable law, or that we reasonably believe poses risk to users or the platform.',
      ],
    },
    {
      heading: 'Certificates and provenance',
      paragraphs: [
        'Certificates of authenticity, ownership, show, and related records generated through the platform are informational tools to document claims you make about artworks. They are not legal advice, title insurance, or a guarantee of authenticity, ownership, or value.',
        'You are solely responsible for the accuracy of information you submit. Buyers, collectors, and institutions should perform their own due diligence.',
        'Exported PDFs and operational documents may be marked as MVP or draft; obtain independent legal review before relying on them in formal transactions.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'You agree not to: violate laws; upload malware; scrape or overload the service; circumvent security; harass others; post unlawful or deceptive content; or use the platform to facilitate fraud or money laundering.',
        'We may suspend or terminate accounts that violate these rules.',
      ],
    },
    {
      heading: 'Subscriptions',
      paragraphs: [
        'Paid features are subject to our Billing & Refunds policy. Free and trial access may change as the product evolves.',
      ],
    },
    {
      heading: 'Creator websites',
      paragraphs: [
        'If you publish a creator site on a subdomain or custom domain, you are responsible for the content displayed and for complying with applicable publicity, copyright, and data protection laws for visitors to that site.',
      ],
    },
    {
      heading: 'Disclaimer of warranties',
      paragraphs: [
        'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, ' + entityName.toUpperCase() + ' AND ITS AFFILIATES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR AGGREGATE LIABILITY FOR DIRECT DAMAGES IS LIMITED TO THE GREATER OF AMOUNTS YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR ONE HUNDRED U.S. DOLLARS ($100).',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        'These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law principles, except where mandatory consumer protections in your country of residence apply.',
        'Disputes will be resolved in the courts of Delaware unless otherwise required by applicable law.',
      ],
    },
    {
      heading: 'Changes and contact',
      paragraphs: [
        'We may modify these Terms by posting an updated version. Material changes may be communicated via the site or email where appropriate.',
        `Contact: ${contactEmail}`,
      ],
    },
  ]),

  billing: doc('billing', 'Billing & Refunds', [
    {
      paragraphs: [
        `Last updated: ${lastUpdated}`,
        `This Billing & Refunds policy describes subscription pricing, trials, renewals, cancellations, and refunds for paid plans on ${siteUrl}, processed by Stripe on behalf of ${entityName}.`,
        'We are currently in beta; pricing and features may evolve. Subscriptions help support ongoing development.',
      ],
    },
    {
      heading: 'Plans and pricing',
      paragraphs: [
        'Artist: $10/month or $99/year.',
        'Collector: $29.99/month or $299.90/year.',
        'Gallery: $99/month or $990/year.',
        'Yearly plans reflect approximately two months free compared to paying monthly for twelve months. Display prices are shown on the subscription page; the amount charged is confirmed at Stripe checkout.',
        'Certificates and many core features remain free. Paid subscriptions unlock Toolbox features such as Grants, Open Calls, CRM, and Operations tools, as described on the site.',
      ],
    },
    {
      heading: 'Free trial',
      paragraphs: [
        'New accounts may receive a 14-day free trial for subscription-gated Toolbox access. Trial length and eligibility may change. When the trial ends, continued access requires an active paid subscription unless we state otherwise.',
      ],
    },
    {
      heading: 'Billing and renewal',
      paragraphs: [
        'Subscriptions renew automatically at the end of each billing period (monthly or yearly) until canceled.',
        'Payment is processed by Stripe. We accept payment methods supported by Stripe at checkout, which may include card and Apple Pay.',
        'You are responsible for keeping payment information current. Failed payments may result in suspension of paid features.',
      ],
    },
    {
      heading: 'Cancellation',
      paragraphs: [
        'You may cancel renewal at any time through the Stripe Customer Portal ("Manage Billing & Payment" on the subscription page). Cancellation stops future charges; you typically retain access through the end of the current paid period unless otherwise stated.',
        'Deleting your account does not automatically cancel an active Stripe subscription; cancel billing first to avoid further charges.',
      ],
    },
    {
      heading: 'Refunds',
      paragraphs: [
        'Except where required by applicable law, subscription fees are generally non-refundable, including for partial billing periods, unused time, or after a renewal charge.',
        'If you believe you were charged in error, contact ' + contactEmail + ' within 14 days of the charge. We will review requests in good faith and coordinate with Stripe where appropriate.',
        'Residents of certain jurisdictions may have statutory withdrawal or refund rights; nothing in this policy limits those rights.',
      ],
    },
    {
      heading: 'Price changes',
      paragraphs: [
        'We may change prices or plan features with reasonable notice. Changes apply to subsequent billing periods. If you do not agree, cancel before the next renewal.',
      ],
    },
    {
      heading: 'Taxes',
      paragraphs: [
        'Prices may exclude applicable taxes. Stripe may calculate and collect tax where required.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `Billing questions: ${contactEmail}`,
      ],
    },
  ]),
};

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  return LEGAL_DOCUMENTS[id];
}
