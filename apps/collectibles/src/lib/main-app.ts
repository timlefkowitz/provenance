/**
 * The collectibles planet app (collc.provenance.guru) is a marketing / entry
 * surface. The actual product — auth, accounts, image storage, certificates,
 * QR/scan, value rollups — lives in the main Provenance app, so all product
 * links deep-link there rather than duplicating the whole CRUD here.
 */
export const MAIN_APP_URL = (
  process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://provenance.guru'
).replace(/\/$/, '');

export const collectiblesPath = (path = '') => `${MAIN_APP_URL}/collectibles${path}`;
