import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSiteData } from '../_data/get-site-data';
import { SiteContactBlock } from '../../_components/site-contact-block';

export const dynamic = 'force-dynamic';

export default async function SiteContactPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const site = await getSiteData(handle);

  if (!site || !site.published_at) {
    notFound();
  }

  const accentColor = resolveAccent(site.theme.accent);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111', background: '#fff', minHeight: '100svh' }}>
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: accentColor }}
        >
          ← {site.name}
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold mb-10" style={{ color: '#111' }}>
          Contact
        </h1>
        <SiteContactBlock
          name={site.name}
          website={site.website}
          location={site.location}
          medium={site.medium}
        />
      </div>
    </div>
  );
}

function resolveAccent(key: string): string {
  const map: Record<string, string> = {
    wine: '#4A2F25', slate: '#3D4B5C', forest: '#2D4A3E',
    sand: '#8B7355', midnight: '#1A1A2E', rose: '#8B4558',
  };
  return map[key] ?? '#4A2F25';
}
