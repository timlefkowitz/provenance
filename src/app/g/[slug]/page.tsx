import { permanentRedirect, redirect } from 'next/navigation';

export const metadata = {
  title: 'Gallery | Provenance',
};

/**
 * Legacy short link: permanently redirect to canonical `/gallery/{slug}`.
 */
export default async function GalleryShortLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug).trim();
  if (!decoded) {
    redirect('/registry');
  }
  console.log('[Gallery URL] /g/ redirect to /gallery/', { slug: decoded });
  permanentRedirect(`/gallery/${encodeURIComponent(decoded)}`);
}
