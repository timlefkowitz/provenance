import { redirect } from 'next/navigation';

export default async function ArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/artworks/${id}/certificate`);
}
