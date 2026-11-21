/**
 * Copy for the printed gallery & museum brochure (/admin/brochure).
 *
 * This is the only file to edit when the wording changes. Every page is a
 * half-letter page in an 8-page saddle-stitched booklet (two US Letter sheets,
 * printed double-sided, folded and stapled). Keep each page roughly to the
 * length it has now, or it will overflow when printed: check the preview.
 *
 * Rules: no invented statistics or customer logos, and only name features
 * that exist in the app.
 */

export type BrochureSection = 'Record' | 'Tools' | 'Network';

export type BrochureImage = { src: string; caption?: string };

export type BrochureContent = {
  /** Shown top right on every page. */
  kicker: string;
  nav: BrochureSection[];
  website: string;
  cover: { eyebrow: string; headline: string; sub: string; image: BrochureImage };
  problem: {
    eyebrow: string;
    headline: string;
    lead: string;
    points: Array<{ title: string; body: string }>;
    quote: string;
  };
  record: {
    eyebrow: string;
    headline: string;
    lead: string;
    chain: Array<{ role: string; does: string }>;
    compare: { left: string; right: string; rows: Array<[string, string]> };
    statement: string;
  };
  dropoff: {
    eyebrow: string;
    headline: string;
    lead: string;
    steps: Array<{ title: string; body: string }>;
    image: BrochureImage;
  };
  tools: {
    eyebrow: string;
    headline: string;
    lead: string;
    items: Array<{ title: string; body: string }>;
    image: BrochureImage;
  };
  looking: {
    eyebrow: string;
    headline: string;
    lead: string;
    points: Array<{ title: string; body: string }>;
    image: BrochureImage;
  };
  artists: {
    eyebrow: string;
    headline: string;
    lead: string;
    items: Array<{ title: string; body: string }>;
    image: BrochureImage;
    closing: string;
  };
  back: {
    headline: string;
    sub: string;
    /** The QR code on the back cover opens this. */
    qrUrl: string;
    qrLabel: string;
    /** Leave a field empty to leave it off the page. */
    contact: { name: string; email: string; phone: string };
    roles: string;
  };
};

export const BROCHURE: BrochureContent = {
  kicker: 'For galleries & museums',
  nav: ['Record', 'Tools', 'Network'],
  website: 'provenance.guru',

  cover: {
    eyebrow: 'The artist-first provenance registry',
    headline: 'The record should travel with the work',
    sub: 'Artists, galleries, collectors and museums keeping one living history for every artwork, from the studio to the permanent collection.',
    image: { src: '/marketing/gallery-window.jpg' },
  },

  problem: {
    eyebrow: '01 · The problem',
    headline: 'Every handoff loses a little history',
    lead: 'An artwork’s documentation is only as strong as its weakest transfer. Each time a work changes hands, someone retypes, re-photographs and re-asks, and something falls through.',
    points: [
      {
        title: 'Records live in silos',
        body: 'The artist’s spreadsheet, the gallery’s inventory, the collector’s inbox, the museum’s TMS. None of them talk to each other.',
      },
      {
        title: 'Galleries start from zero',
        body: 'Staff retype titles, media and dimensions the artist already knew, during the busiest week of the show: install.',
      },
      {
        title: 'Ownership is a text field',
        body: 'A former owner is a name typed into a box, not a link to someone who can confirm it. The chain can’t be checked.',
      },
      {
        title: 'Discovery stops at the door',
        body: 'A work shown in your space stays invisible to the curator, museum and collector who would care about it most.',
      },
    ],
    quote: 'Provenance is the most important asset in an artist’s career, and the one most often lost.',
  },

  record: {
    eyebrow: '02 · The connected record',
    headline: 'One object. Many hands',
    lead: 'On Provenance an artwork is a connected object, not a row in a database. Everyone who holds it adds to the same record, and the history moves with the work.',
    chain: [
      { role: 'Artist', does: 'Creates the record: images, medium, dimensions, edition, story.' },
      { role: 'Gallery', does: 'Exhibits, labels and sells it, and records the sale.' },
      { role: 'Collector', does: 'Claims the transfer and holds the certificate.' },
      { role: 'Museum', does: 'Accessions it with the full history attached.' },
    ],
    compare: {
      left: 'A plain record',
      right: 'A Provenance record',
      rows: [
        ['Owner typed as a name', 'Owner linked to a real account that claims the transfer'],
        ['Kept by one institution', 'Kept together by the artist and every institution'],
        ['History stops when the work leaves', 'History follows the work to its next home'],
        ['Exported, emailed, retyped', 'One record, updated in place'],
        ['Invisible outside your walls', 'Discoverable by galleries, collectors and museums'],
      ],
    },
    statement: 'Not a row in someone’s database. A connected object that remembers every hand it passed through.',
  },

  dropoff: {
    eyebrow: '03 · Before drop-off',
    headline: 'The paperwork arrives before the painting',
    lead: 'Ask artists to create their records before the work comes in. Check-in becomes confirming details, not typing them.',
    steps: [
      {
        title: 'The artist builds the record',
        body: 'From the studio: photos, title, medium, dimensions, past shows and sales.',
      },
      {
        title: 'The gallery accepts it',
        body: 'Confirm the details, add the show and the price. The provenance is already there to update.',
      },
      {
        title: 'Shoot the checklist',
        body: 'Photograph or upload an existing checklist or document and it becomes an exhibition or a collection.',
      },
      {
        title: 'Nobody gets left out',
        body: 'Artists who aren’t comfortable with technology can have a gallerist, assistant or family member build their body of work from photos.',
      },
    ],
    image: { src: '/marketing/install-ladder.jpg', caption: 'Install week. The records were already done.' },
  },

  tools: {
    eyebrow: '04 · For your walls',
    headline: 'Labels, catalogs, QR and NFC from one record',
    lead: 'Get the data right once and everything you print is right too.',
    items: [
      { title: 'Wall labels', body: 'A full set in minutes, each with a QR code to the work’s certificate.' },
      { title: 'Catalogs', body: 'Exhibition catalogs and stapled booklets in three styles, from an office printer.' },
      { title: 'QR posters', body: 'Styled codes for the window, the front desk and the checklist.' },
      { title: 'NFC tags', body: 'A phone tapped to the wall opens the certificate.' },
      { title: 'Certificates', body: 'A certificate of authenticity for every work, claimed by its owner.' },
      { title: 'Exhibition pages', body: 'A public page for every show, current as works sell.' },
    ],
    image: { src: '/marketing/screen-catalog-spread.webp', caption: 'An exhibition catalog, printed from the show’s records.' },
  },

  looking: {
    eyebrow: '05 · Analytics & discovery',
    headline: 'See who is reading the certificate',
    lead: 'Every scan, tap and view is counted, so you know which works draw attention during the show and long after it closes.',
    points: [
      {
        title: 'Certificate views',
        body: 'How often each work’s certificate is opened, not counting its owner’s own visits.',
      },
      {
        title: 'Scans and taps',
        body: 'QR and NFC scans from the wall, per show and per work.',
      },
      {
        title: 'Discovery across institutions',
        body: 'A work shown in your space can be found by museums, curators, collectors and other galleries on the network.',
      },
    ],
    image: { src: '/marketing/wall-chris-king.jpg', caption: 'Works by Chris King on the wall.' },
  },

  artists: {
    eyebrow: '06 · The network',
    headline: 'Artists keep it current because it pays them back',
    lead: 'A registry only works if people keep it up to date. Provenance gives artists everyday reasons to.',
    items: [
      {
        title: 'Grants, residencies & open calls',
        body: 'A weekly digest matched to each artist’s CV, with deadline reminders.',
      },
      { title: 'Sales of their work', body: 'Notified when a work sells and changes hands.' },
      {
        title: 'Reasons their value is rising',
        body: 'Shows, sales and press that strengthen a work’s record, brought to the artist.',
      },
      {
        title: 'A website from their uploads',
        body: 'Upload the work and Provenance builds the site, with a custom domain.',
      },
      {
        title: 'Built with you',
        body: 'We build alongside our partners. Tell us what your program needs.',
      },
    ],
    image: { src: '/marketing/screen-exhibition.webp', caption: 'Every show and every work gets its own public page.' },
    closing: 'Better-kept artist records mean less work and better data for every gallery and museum the work passes through.',
  },

  back: {
    headline: 'Start a pilot',
    sub: 'Bring your next exhibition onto Provenance. We’ll help your artists build their records before install.',
    qrUrl: 'https://provenance.guru/lp/gallery',
    qrLabel: 'Scan to learn more',
    contact: { name: '', email: '', phone: '' },
    roles: 'Artists create. Galleries exhibit. Collectors keep. Museums preserve. One record.',
  },
};
