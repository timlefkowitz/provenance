import { redirect } from 'next/navigation';

/**
 * The apps/web home page redirects to the main Provenance application.
 * This shell app handles marketing pages and subdomain persona LPs;
 * the actual authenticated product lives at the main app (src/).
 */
export default function HomePage() {
  // Redirect authenticated users who land here to the real product.
  const productUrl = process.env.NEXT_PUBLIC_PRODUCT_URL || 'https://provenance.guru';
  redirect(`${productUrl}/artworks`);
}
