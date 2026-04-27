import type { MetadataRoute } from 'next';

/**
 * Web App Manifest for Provenance.
 *
 * This makes the site installable as a PWA on iPhone (Add to Home Screen),
 * Android, and desktop. When wrapped with Capacitor for the App Store later,
 * the same manifest values are reused for the native shell.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Provenance — A Journal of Art, Objects & Their Histories',
    short_name: 'Provenance',
    description:
      'Verified provenance entries and immutable historical timelines for art, objects, and collectibles.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F1E8',
    theme_color: '#4A2F25',
    categories: ['lifestyle', 'productivity', 'art'],
    icons: [
      {
        src: '/app-icon.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/app-icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/app-icon.jpg',
        sizes: '1024x1024',
        type: 'image/jpeg',
        purpose: 'any',
      },
    ],
  };
}
