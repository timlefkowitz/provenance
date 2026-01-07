'use server';

import { addFeaturedArtwork } from '~/app/admin/_actions/manage-featured-artworks';

// Re-export the addFeaturedArtwork function for use in the certificate component
export async function featureArtwork(artworkId: string) {
  return await addFeaturedArtwork(artworkId);
}

