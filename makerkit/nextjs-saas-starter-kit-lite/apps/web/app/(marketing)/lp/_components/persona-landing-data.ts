import pathsConfig from '~/config/paths.config';

export type PersonaCta = {
  label: 'Start free' | 'Subscribe';
  href: string;
};

export type PersonaFaq = {
  question: string;
  answer: string;
};

export type PersonaLandingConfig = {
  slug: 'artist' | 'collector' | 'gallery' | 'institution';
  pill: string;
  title: string;
  subtitle: string;
  /** Search: unique title + meta description + keywords */
  seo: {
    pageTitle: string;
    description: string;
    keywords: string[];
  };
  /** Search + FAQ rich results */
  faqs: [PersonaFaq, PersonaFaq, PersonaFaq];
  outcomes: [string, string, string];
  proofSectionTitle: string;
  proofCards: Array<{
    title: string;
    body: string;
    badge?: string;
  }>;
  testimonial: {
    quote: string;
    attribution: string;
    statusNote: string;
  };
  cta: PersonaCta;
  /** Tailwind gradient / ring accent for hero and bullets */
  accentClass: string;
};

const signUp = pathsConfig.auth.signUp;

export const PERSONA_LANDING_PAGES: Record<
  PersonaLandingConfig['slug'],
  PersonaLandingConfig
> = {
  artist: {
    slug: 'artist',
    pill: 'For artists',
    title: 'Certificates, studio CRM, and grant signal in one place',
    subtitle:
      'Register your work with a clear chain of authenticity, keep collectors aligned, and surface opportunities that match your practice.',
    seo: {
      pageTitle: 'Artists — Certificates of authenticity, grants & studio CRM | Provenance',
      description:
        'Register artworks with artist-first certificate workflows, track studio sales leads, and match grants to your CV—all in one provenance registry.',
      keywords: [
        'certificate of authenticity',
        'artist CRM',
        'art grants',
        'provenance registry',
        'artist studio sales',
        'digital CoA',
        'artwork authentication',
      ],
    },
    faqs: [
      {
        question: 'What is a certificate of authenticity on Provenance?',
        answer:
          'It is a structured digital record tied to your artwork that can move through artist claim, owner verification, and public verified states—stronger than a PDF stored in email.',
      },
      {
        question: 'Can collectors see everything I upload?',
        answer:
          'You control draft versus published or verified visibility depending on workflow; the goal is a defensible record without forcing every note public on day one.',
      },
      {
        question: 'How do grants connect to my practice?',
        answer:
          'You can upload a CV once, extract structured fields, and persist curated or personalized grant rows so deadlines and eligibility stay filterable.',
      },
    ],
    outcomes: [
      'Issue and manage Certificates of Authenticity with artist-first workflows (claim, verify, publish).',
      'Track interest and sales stages so studio inquiries do not get lost.',
      'Upload your CV once to power curated grant discovery and bookmarking.',
    ],
    proofSectionTitle: 'Early proof & previews',
    proofCards: [
      {
        title: 'Certificate workflow',
        body: 'Artist claim → owner verification → verified public record (UI in active development).',
        badge: 'Product preview',
      },
      {
        title: 'Provenance journal',
        body: 'Structured fields for exhibitions, auction history, and literature references alongside a living timeline.',
        badge: 'Example data',
      },
      {
        title: 'Screenshot',
        body: 'Marketing capture of the certificate view will ship here next.',
        badge: 'Placeholder',
      },
    ],
    testimonial: {
      quote:
        'We are piloting Provenance so every new body of work ships with a defensible record from day one.',
      attribution: 'Painter & educator, permission pending',
      statusNote: 'Testimonial in progress — validating with first studio pilots.',
    },
    cta: { label: 'Start free', href: `${signUp}?persona=artist` },
    accentClass:
      'from-rose-950/90 via-rose-900/80 to-amber-950/70 dark:from-rose-900/80 dark:via-rose-950/90 dark:to-stone-950',
  },
  collector: {
    slug: 'collector',
    pill: 'For collectors',
    title: 'Ownership you can show, provenance you can defend',
    subtitle:
      'Document acquisitions, preserve exhibition and auction context, and keep certificates consistent across your collection.',
    seo: {
      pageTitle: 'Collectors — Art provenance, ownership certificates & collection records | Provenance',
      description:
        'Build a collection registry with certificates of ownership, former owners, auction history, and collaborative provenance updates you can show lenders and advisors.',
      keywords: [
        'art collector software',
        'certificate of ownership',
        'collection provenance',
        'auction history art',
        'art collection management',
        'provenance documentation',
      ],
    },
    faqs: [
      {
        question: 'What is a certificate of ownership?',
        answer:
          'It is the collector-facing counterpart to an artist certificate of authenticity: a record that ties you to the object with structured provenance fields, not only an invoice image.',
      },
      {
        question: 'Can I keep acquisitions private?',
        answer:
          'Many objects support private drafts and controlled public or verified states so you can work with advisors before anything appears in a public feed.',
      },
      {
        question: 'How do provenance corrections work?',
        answer:
          'Structured provenance update requests let third parties propose edits while the record owner approves or denies—reducing silent tampering.',
      },
    ],
    outcomes: [
      'Certificates of ownership tied to rich provenance fields—not just a JPEG in a folder.',
      'Private drafts and public verified views so you control what the market sees.',
      'Collaborative corrections through structured update requests to the record keeper.',
    ],
    proofSectionTitle: 'Early proof & previews',
    proofCards: [
      {
        title: 'Collection narrative',
        body: 'Former owners, auction lots, and institutional loans captured in one registry-shaped record.',
        badge: 'Schema-backed',
      },
      {
        title: 'Verification lane',
        body: 'Collector/gallery verification timestamps pair with artist claims for higher-trust states.',
        badge: 'Workflow',
      },
      {
        title: 'Screenshot',
        body: 'Collector dashboard mock will replace this card once design QA is done.',
        badge: 'Placeholder',
      },
    ],
    testimonial: {
      quote:
        'Our board wants provenance packets that look like a museum file, not a spreadsheet tab.',
      attribution: 'Private collector, Midwest — permission pending',
      statusNote: 'Testimonial in progress — collecting first case studies.',
    },
    cta: { label: 'Start free', href: `${signUp}?persona=collector` },
    accentClass:
      'from-slate-950/90 via-blue-950/75 to-slate-900/70 dark:from-slate-900 dark:via-blue-950/80 dark:to-slate-950',
  },
  gallery: {
    slug: 'gallery',
    pill: 'For galleries',
    title: 'Exhibitions, open calls, and roster tools built for trust',
    subtitle:
      'Run shows and submissions on a single platform while issuing show-appropriate certificates and stewarding artist profiles.',
    seo: {
      pageTitle: 'Galleries — Exhibitions, open calls & artist roster on Provenance',
      description:
        'Manage exhibitions, publish open calls with submission windows, coordinate gallery staff permissions, and steward artist registry claims from one platform.',
      keywords: [
        'gallery open call software',
        'exhibition management art',
        'gallery CRM',
        'artist roster',
        'certificate of show',
        'gallery submissions',
      ],
    },
    faqs: [
      {
        question: 'Can my staff manage artworks without sharing one login?',
        answer:
          'Gallery member roles pair with row-level security so teammates can operate against the same gallery profile without handing out the owner password.',
      },
      {
        question: 'What is a certificate of show?',
        answer:
          'It is the gallery-issued certificate type aligned to exhibitions and consigned works—distinct from artist authenticity or collector ownership records.',
      },
      {
        question: 'How do open calls handle deadlines?',
        answer:
          'Open calls support submission open and close dates plus call types and location eligibility so artists only see what they can realistically apply to.',
      },
    ],
    outcomes: [
      'Exhibitions and artwork links with team permissions for gallery staff.',
      'Open calls with submission windows, call types, and location-aware eligibility.',
      'Artist registry stubs with claim and approval flows so your roster stays accurate.',
    ],
    proofSectionTitle: 'Early proof & previews',
    proofCards: [
      {
        title: 'Open call model',
        body: 'Submission open/close dates, external URL for curated listings, and grant-style call types.',
        badge: 'Live schema',
      },
      {
        title: 'Team access',
        body: 'Gallery members inherit RLS-aware permissions on artworks and exhibitions.',
        badge: 'Security model',
      },
      {
        title: 'Screenshot',
        body: 'Gallery landing capture pending; using structured UI placeholders for now.',
        badge: 'Placeholder',
      },
    ],
    testimonial: {
      quote:
        'We need one system for booth inventory, wall labels, and the digital certificates collectors expect.',
      attribution: 'Contemporary gallery, permission pending',
      statusNote: 'Testimonial in progress — scheduling first partner interviews.',
    },
    cta: { label: 'Start free', href: `${signUp}?persona=gallery` },
    accentClass:
      'from-violet-950/85 via-purple-950/75 to-slate-950/80 dark:from-violet-900/80 dark:via-purple-950/85 dark:to-slate-950',
  },
  institution: {
    slug: 'institution',
    pill: 'For institutions',
    title: 'Institutional tools that keep collections accountable—and help artists grow',
    subtitle:
      'Certificates of authenticity, ownership, and intermediary share one registry with collection management, invoicing, loan agreements, and verification-ready APIs.',
    seo: {
      pageTitle:
        'Institutions — Collection management, certificates & provenance transfers | Provenance',
      description:
        'Museums and foundations unify COA, ownership, and intermediary certificates with accessioning, loans, invoicing, and append-only events—plus scoped API keys for partner verification.',
      keywords: [
        'museum collection management',
        'certificate of intermediary',
        'certificate of authenticity museum',
        'collection provenance software',
        'art loan agreement software',
        'museum invoicing art collection',
        'provenance API',
        'digital collection audit trail',
      ],
    },
    faqs: [
      {
        question: 'How do certificates of authenticity, ownership, and intermediary work together?',
        answer:
          'They share the same registry-backed record so authenticity, title, and handoff context stay aligned. Structured transfers let counterparties accept provenance updates in one action instead of reconciling separate PDFs.',
      },
      {
        question: 'What does append-only asset event logging give our registrar team?',
        answer:
          'Each custody or movement change emits a transparent record with actor, payload, and timestamp—ideal for loans, cross-department accountability, and the traveling-exhibition paper trail boards expect.',
      },
      {
        question: 'How mature is the HTTP verification API?',
        answer:
          'API key storage, scopes, and rate limits exist in the database today; wire your preferred edge or service layer to expose partner endpoints when you are ready.',
      },
    ],
    outcomes: [
      'Shared certificate graph for authenticity, ownership, and intermediary roles—no siloed PDFs.',
      'Collection management with accessioning, loans, labels, invoicing, and provenance in one workflow.',
      'Append-only events, globally unique certificate numbers, and scoped API keys for partner verification.',
    ],
    proofSectionTitle: 'Early proof & previews',
    proofCards: [
      {
        title: 'Event ledger',
        body: 'Public read on asset_events for transparency; authenticated inserts only—no silent edits.',
        badge: 'Architecture',
      },
      {
        title: 'Certificates table',
        body: 'Unified certificate registry spanning art, collectibles, vehicles, and real property verticals.',
        badge: 'Data model',
      },
      {
        title: 'API surface',
        body: 'Key management exists in-database; HTTP verification routes ship next on your timeline.',
        badge: 'Roadmap',
      },
    ],
    testimonial: {
      quote:
        'We are evaluating Provenance where our TMS ends and public trust begins—especially for traveling exhibitions.',
      attribution: 'Registrar office, permission pending',
      statusNote: 'Testimonial in progress — NDAs in review.',
    },
    cta: { label: 'Subscribe', href: `${signUp}?persona=institution` },
    accentClass:
      'from-emerald-950/80 via-teal-950/75 to-stone-950/85 dark:from-emerald-900/75 dark:via-teal-950/80 dark:to-stone-950',
  },
};
