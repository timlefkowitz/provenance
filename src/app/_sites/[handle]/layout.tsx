import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSiteData } from './_data/get-site-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const site = await getSiteData(handle);
  if (!site) {
    return { title: 'Not Found' };
  }
  return {
    title: `${site.name}`,
    description: site.bio ?? `${site.name} on Provenance`,
    openGraph: {
      title: site.name,
      description: site.bio ?? undefined,
      images: site.picture_url ? [{ url: site.picture_url }] : [],
    },
  };
}

/**
 * Chromeless layout for creator sites at <handle>.provenance.app.
 * Deliberately omits Navigation, TrialBanner, analytics, and all platform chrome.
 * Pages under this layout are fully public — no Supabase session refresh.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const site = await getSiteData(handle);

  if (!site || !site.published_at) {
    notFound();
  }

  const accentVar = getSiteAccentCss(site.theme.accent);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={`https://${handle}.provenance.app`} />
      </head>
      <body
        className="antialiased overflow-x-hidden"
        style={accentVar}
      >
        {children}

        {/* Powered-by badge — tasteful footer attribution */}
        <div className="py-4 text-center border-t border-black/5">
          <a
            href="https://provenance.app"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-black/30 hover:text-black/50 transition-colors"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            Made with Provenance
          </a>
        </div>
      </body>
    </html>
  );
}

/**
 * Map the accent key to a CSS custom property so templates can use
 * `var(--site-accent)` without coupling to Tailwind config.
 */
function getSiteAccentCss(accentKey: string): React.CSSProperties {
  const palette: Record<string, string> = {
    wine:     '#4A2F25',
    slate:    '#3D4B5C',
    forest:   '#2D4A3E',
    sand:     '#8B7355',
    midnight: '#1A1A2E',
    rose:     '#8B4558',
  };
  const value = palette[accentKey] ?? palette['wine'];
  return { '--site-accent': value } as React.CSSProperties;
}
