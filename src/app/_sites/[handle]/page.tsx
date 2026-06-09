import { notFound } from 'next/navigation';
import { getSiteData } from './_data/get-site-data';
import { renderSiteTemplate } from '../_templates/render-template';

export const dynamic = 'force-dynamic';

export default async function SitePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const site = await getSiteData(handle);

  if (!site || !site.published_at) {
    notFound();
  }

  return renderSiteTemplate(site);
}
