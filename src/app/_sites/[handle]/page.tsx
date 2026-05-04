import { notFound } from 'next/navigation';
import { getSiteData } from './_data/get-site-data';
import { EditorialTemplate } from '../_templates/editorial';
import { StudioTemplate } from '../_templates/studio';
import { AtelierTemplate } from '../_templates/atelier';

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

  switch (site.template_id) {
    case 'editorial':
      return <EditorialTemplate site={site} />;
    case 'studio':
      return <StudioTemplate site={site} />;
    case 'atelier':
      return <AtelierTemplate site={site} />;
    default:
      return <StudioTemplate site={site} />;
  }
}
