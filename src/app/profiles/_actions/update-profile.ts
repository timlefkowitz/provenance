'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { USER_ROLES } from '~/lib/user-roles';
import { dedupeNewsPublications } from '~/lib/news-publications';
import { isGalleryMember } from '~/app/profiles/_actions/gallery-members';
import { validateGalleryPublicSlug } from '~/lib/gallery-public-slug';

export interface UpdateProfileInput {
  profileId: string;
  name?: string;
  picture_url?: string;
  bio?: string;
  medium?: string;
  location?: string;
  website?: string;
  links?: string[];
  galleries?: string[];
  contact_email?: string;
  phone?: string;
  established_year?: number;
  is_active?: boolean;
  /** Gallery only: public URL segment for /g/{slug} and /gallery/{slug} */
  slug?: string;
  news_publications?: { title: string; url: string; publication_name?: string; date?: string }[];
}

/**
 * Update an existing role profile
 */
export async function updateProfile(input: UpdateProfileInput) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to update a profile' };
    }

    // user_profiles not in generated DB types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client as any;
    const { data: profile, error: fetchError } = await sb
      .from('user_profiles')
      .select('user_id, role, slug')
      .eq('id', input.profileId)
      .single();

    if (fetchError || !profile) {
      return { error: 'Profile not found' };
    }

    const isOwner = profile.user_id === user.id;
    const isGalleryTeamMember =
      profile.role === USER_ROLES.GALLERY &&
      (await isGalleryMember(user.id, input.profileId));

    if (!isOwner && !isGalleryTeamMember) {
      return { error: 'You do not have permission to update this profile' };
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.picture_url !== undefined) updateData.picture_url = input.picture_url || null;
    if (input.bio !== undefined) updateData.bio = input.bio?.trim() || null;
    if (input.medium !== undefined) updateData.medium = input.medium?.trim() || null;
    if (input.location !== undefined) updateData.location = input.location?.trim() || null;
    if (input.website !== undefined) updateData.website = input.website?.trim() || null;
    if (input.links !== undefined) updateData.links = input.links || [];
    if (input.galleries !== undefined) updateData.galleries = input.galleries || [];
    if (input.contact_email !== undefined) updateData.contact_email = input.contact_email?.trim() || null;
    if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null;
    if (input.established_year !== undefined) updateData.established_year = input.established_year || null;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.news_publications !== undefined) {
      const raw = Array.isArray(input.news_publications) ? input.news_publications : [];
      updateData.news_publications = dedupeNewsPublications(
        raw.filter((p) => p.title?.trim() && p.url?.trim()),
      );
    }

    if (input.slug !== undefined && profile.role === USER_ROLES.GALLERY) {
      const validated = validateGalleryPublicSlug(input.slug);
      if (!validated.ok) {
        return { error: validated.error };
      }
      const currentSlug = (profile.slug as string | null)?.toLowerCase() ?? null;
      if (validated.normalized !== currentSlug) {
        const { data: taken } = await sb
          .from('user_profiles')
          .select('id')
          .eq('role', USER_ROLES.GALLERY)
          .eq('slug', validated.normalized)
          .neq('id', input.profileId)
          .maybeSingle();
        if (taken) {
          return { error: 'That public URL is already taken by another gallery' };
        }
        updateData.slug = validated.normalized;
        console.log('[Profiles] updateProfile gallery slug changed', {
          profileId: input.profileId,
        });
      }
    }

    // Update the profile
    const { data, error } = await sb
      .from('user_profiles')
      .update(updateData)
      .eq('id', input.profileId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      if (error.code === '23505' && String(error.message || '').includes('slug')) {
        return { error: 'That public URL is already taken by another gallery' };
      }
      return { error: error.message || 'Failed to update profile' };
    }

    revalidatePath('/profile');
    revalidatePath('/profiles');
    revalidatePath(`/profiles/${input.profileId}/edit`);
    if (profile.user_id) {
      revalidatePath(`/artists/${profile.user_id}`);
    }

    return { success: true, profile: data };
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return { error: 'An unexpected error occurred' };
  }
}

