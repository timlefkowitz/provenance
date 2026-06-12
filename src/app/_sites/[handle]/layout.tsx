import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteData, getRootDomain } from './_data/get-site-data';
import { resolveAccent } from '../_templates/palette';
import {
  ProvenanceSiteBar,
  PoweredByProvenanceFooter,
} from '../_components/provenance-site-bar';

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
  const rootDomain = getRootDomain();
  const canonicalUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : `https://${handle}.${rootDomain}`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={canonicalUrl} />
      </head>
      <body
        className="antialiased overflow-x-hidden"
        style={accentVar}
      >
        {!site.is_white_label && <ProvenanceSiteBar />}
        {children}
        {!site.is_white_label && <PoweredByProvenanceFooter />}
      </body>
    </html>
  );
}

/**
 * Map the accent key to a CSS custom property so templates can use
 * `var(--site-accent)` without coupling to Tailwind config.
 */
function getSiteAccentCss(accentKey: string): React.CSSProperties {
  const value = resolveAccent(accentKey);
  return { '--site-accent': value } as React.CSSProperties;
}
