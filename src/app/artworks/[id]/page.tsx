import { permanentRedirect } from 'next/navigation';

/**
 * The canonical page for a single artwork is its certificate at
 * `/artworks/[id]/certificate`. A number of links throughout the app
 * (operations timeline, COA/COO/COS issued events, notifications, portal,
 * shipping/inventory/insurance/consignment tabs, etc.) historically pointed
 * to the bare `/artworks/[id]` route, which previously 404'd because no
 * page existed here.
 *
 * This route forwards those clicks to the certificate so that COA, COO, and
 * COS references all open correctly. Using a permanent redirect keeps the
 * URL canonical and lets revalidatePath('/artworks/[id]') calls resolve to
 * a real route segment.
 */
export default async function ArtworkRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/artworks/${id}/certificate`);
}
