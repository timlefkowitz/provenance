'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { createProvenanceUpdateRequest } from '../../_actions/create-provenance-update-request';
import { updateProvenance } from '../../edit/_actions/update-provenance';
import { artworkImageUploader } from '~/lib/artwork-storage';

export type EditArtworkFields = {
  title?: string;
  artist_name?: string;
  image_url?: string;
  created_at?: string;
  exhibitionId?: string | null;
};

export async function editArtwork(
  artworkId: string,
  formData: FormData,
  isCreator: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to edit artwork' };
    }

    // Verify artwork exists and get owner
    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, account_id, title, gallery_profile_id')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    // Verify isCreator matches actual ownership or gallery membership
    const actualIsCreator = artwork.account_id === user.id;
    let isGalleryMember = false;

    // Check if user is a member of the gallery that posted this artwork
    if (!actualIsCreator && artwork.gallery_profile_id) {
      const { data: member } = await client
        .from('gallery_members')
        .select('id')
        .eq('gallery_profile_id', artwork.gallery_profile_id)
        .eq('user_id', user.id)
        .single();

      isGalleryMember = !!member;
    }

    const canEdit = actualIsCreator || isGalleryMember;
    if (isCreator !== canEdit) {
      return { success: false, error: 'Permission mismatch' };
    }

    // Build update fields
    const updateFields: EditArtworkFields = {};

    const title = formData.get('title')?.toString().trim();
    if (title !== undefined && title !== artwork.title) {
      updateFields.title = title || null;
    }

    const artistName = formData.get('artist_name')?.toString().trim();
    if (artistName !== undefined) {
      updateFields.artist_name = artistName || null;
    }

    // Handle image upload
    const imageFile = formData.get('image') as File | null;
    if (imageFile && imageFile.size > 0) {
      try {
        const adminClient = getSupabaseServerAdminClient();
        const imageUrl = await artworkImageUploader.upload(client, adminClient, imageFile, user.id);
        if (imageUrl) {
          updateFields.image_url = imageUrl;
        }
      } catch (imageError: any) {
        return { success: false, error: `Image upload failed: ${imageError.message}` };
      }
    }

    // Handle created_at (Date Certified)
    const createdAt = formData.get('created_at')?.toString();
    if (createdAt) {
      updateFields.created_at = createdAt;
    }

    // Handle exhibition
    const exhibitionId = formData.get('exhibitionId')?.toString();
    if (exhibitionId !== undefined) {
      updateFields.exhibitionId = exhibitionId === '__none__' || exhibitionId === '' ? null : exhibitionId;
    }

    // If no changes, return early
    if (Object.keys(updateFields).length === 0 && !imageFile) {
      return { success: false, error: 'No changes detected' };
    }

    if (isCreator) {
      // Direct edit - user is the creator
      const provenanceUpdate: any = {};
      
      if (updateFields.title !== undefined) {
        provenanceUpdate.title = updateFields.title;
      }
      if (updateFields.artist_name !== undefined) {
        provenanceUpdate.artist_name = updateFields.artist_name;
      }
      if (updateFields.exhibitionId !== undefined) {
        provenanceUpdate.exhibitionId = updateFields.exhibitionId;
      }

      // Update image_url directly if provided
      if (updateFields.image_url) {
        const { error: imageUpdateError } = await (client as any)
          .from('artworks')
          .update({ image_url: updateFields.image_url })
          .eq('id', artworkId);

        if (imageUpdateError) {
          console.error('Error updating image:', imageUpdateError);
          return { success: false, error: 'Failed to update image' };
        }
      }

      // Update created_at directly if provided
      if (updateFields.created_at) {
        const { error: dateUpdateError } = await (client as any)
          .from('artworks')
          .update({ created_at: updateFields.created_at })
          .eq('id', artworkId);

        if (dateUpdateError) {
          console.error('Error updating date:', dateUpdateError);
          return { success: false, error: 'Failed to update date' };
        }
      }

      // Handle exhibition updates if user owns the exhibition
      const exhibitionId = formData.get('exhibitionId')?.toString();
      const exhibitionTitle = formData.get('exhibitionTitle')?.toString();
      const exhibitionStartDate = formData.get('exhibitionStartDate')?.toString();
      const exhibitionEndDate = formData.get('exhibitionEndDate')?.toString();
      const exhibitionLocation = formData.get('exhibitionLocation')?.toString();
      const exhibitionGalleryId = formData.get('exhibitionGalleryId')?.toString();

      if (exhibitionId && exhibitionId !== '__none__' && exhibitionTitle) {
        // Verify user owns this exhibition
        const { data: exhibition } = await (client as any)
          .from('exhibitions')
          .select('gallery_id')
          .eq('id', exhibitionId)
          .single();

        if (exhibition && exhibition.gallery_id === user.id) {
          // Update exhibition
          const exhibitionUpdate: any = {
            title: exhibitionTitle.trim(),
            start_date: exhibitionStartDate || null,
            end_date: exhibitionEndDate || null,
            location: exhibitionLocation?.trim() || null,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          };

          if (exhibitionGalleryId) {
            exhibitionUpdate.gallery_id = exhibitionGalleryId;
          }

          const { error: exhibitionUpdateError } = await (client as any)
            .from('exhibitions')
            .update(exhibitionUpdate)
            .eq('id', exhibitionId);

          if (exhibitionUpdateError) {
            console.error('Error updating exhibition:', exhibitionUpdateError);
            return { success: false, error: 'Failed to update exhibition' };
          }
        }
      }

      // Use existing updateProvenance for other fields
      if (Object.keys(provenanceUpdate).length > 0) {
        const result = await updateProvenance(artworkId, provenanceUpdate, {
          skipOwnershipCheck: true,
          skipNotification: true,
        });

        if (result.error) {
          return { success: false, error: result.error };
        }
      }

      revalidatePath(`/artworks/${artworkId}`);
      revalidatePath(`/artworks/${artworkId}/certificate`);
      revalidatePath('/artworks');
      if (exhibitionId && exhibitionId !== '__none__') {
        revalidatePath(`/exhibitions/${exhibitionId}`);
        revalidatePath('/exhibitions');
      }

      return { success: true };
    } else {
      // Approval request - user is not the creator
      const requestMessage = formData.get('request_message')?.toString();

      // Convert to ProvenanceUpdateFields format
      const provenanceUpdateFields: any = {};
      if (updateFields.title !== undefined) {
        provenanceUpdateFields.title = updateFields.title;
      }
      if (updateFields.artist_name !== undefined) {
        provenanceUpdateFields.artist_name = updateFields.artist_name;
      }
      if (updateFields.image_url) {
        provenanceUpdateFields.image_url = updateFields.image_url;
      }
      if (updateFields.created_at) {
        provenanceUpdateFields.created_at = updateFields.created_at;
      }
      if (updateFields.exhibitionId !== undefined) {
        provenanceUpdateFields.exhibitionId = updateFields.exhibitionId;
      }

      // Handle exhibition updates for approval requests
      const exhibitionId = formData.get('exhibitionId')?.toString();
      const exhibitionTitle = formData.get('exhibitionTitle')?.toString();
      const exhibitionStartDate = formData.get('exhibitionStartDate')?.toString();
      const exhibitionEndDate = formData.get('exhibitionEndDate')?.toString();
      const exhibitionLocation = formData.get('exhibitionLocation')?.toString();
      const exhibitionGalleryId = formData.get('exhibitionGalleryId')?.toString();

      if (exhibitionId && exhibitionId !== '__none__' && exhibitionTitle) {
        provenanceUpdateFields.exhibitionTitle = exhibitionTitle;
        if (exhibitionStartDate) provenanceUpdateFields.exhibitionStartDate = exhibitionStartDate;
        if (exhibitionEndDate) provenanceUpdateFields.exhibitionEndDate = exhibitionEndDate;
        if (exhibitionLocation) provenanceUpdateFields.exhibitionLocation = exhibitionLocation;
        if (exhibitionGalleryId) provenanceUpdateFields.exhibitionGalleryId = exhibitionGalleryId;
      }

      const result = await createProvenanceUpdateRequest(
        artworkId,
        provenanceUpdateFields,
        requestMessage,
        'provenance_update',
      );

      if (!result.success) {
        return result;
      }

      return { success: true };
    }
  } catch (error: any) {
    console.error('Error in editArtwork:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

