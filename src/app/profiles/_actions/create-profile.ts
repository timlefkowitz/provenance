'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { USER_ROLES, isValidRole, type UserRole } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';
import { validateGalleryPublicSlug } from '~/lib/gallery-public-slug';

export interface CreateProfileInput {
  role: string;
  name: string;
  /** Optional for new galleries; otherwise generated from name */
  slug?: string;
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
  news_publications?: { title: string; url: string; publication_name?: string; date?: string }[];
}

/**
 * Create a new role profile for the current user
 */
export async function createProfile(input: CreateProfileInput) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to create a profile' };
    }

    if (!isValidRole(input.role)) {
      return { error: 'Invalid role' };
    }

    // Check if profile already exists for this role (only for artist and collector)
    // Gallery profiles can be created multiple times
    if (input.role !== 'gallery') {
      const { data: existing } = await client
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', input.role)
        .single();

      if (existing) {
        return { error: `You already have a ${input.role} profile. Please edit it instead.` };
      }
    }

    // Slug for gallery profiles: optional custom, else generated from name
    let slug: string | null = null;
    if (input.role === USER_ROLES.GALLERY) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = client as any;
      if (input.slug !== undefined && input.slug.trim() !== '') {
        const validated = validateGalleryPublicSlug(input.slug);
        if (!validated.ok) {
          return { error: validated.error };
        }
        const { data: taken } = await sb
          .from('user_profiles')
          .select('id')
          .eq('role', USER_ROLES.GALLERY)
          .eq('slug', validated.normalized)
          .maybeSingle();
        if (taken) {
          return { error: 'That public URL is already taken by another gallery' };
        }
        slug = validated.normalized;
        console.log('[Profiles] createProfile gallery custom slug', { slug });
      } else {
        try {
          const { data: generatedSlug, error: slugError } = await sb.rpc(
            'generate_unique_gallery_slug',
            { base_name: input.name.trim() },
          );

          if (!slugError && generatedSlug) {
            slug = generatedSlug;
          }
        } catch (error) {
          console.error('Error generating slug, will create without slug:', error);
        }
      }
    }

    // Create the profile
    const { data, error } = await client
      .from('user_profiles')
      .insert({
        user_id: user.id,
        role: input.role as UserRole,
        name: input.name.trim(),
        slug: slug,
        picture_url: input.picture_url || null,
        bio: input.bio?.trim() || null,
        medium: input.medium?.trim() || null,
        location: input.location?.trim() || null,
        website: input.website?.trim() || null,
        links: input.links || [],
        galleries: input.galleries || [],
        contact_email: input.contact_email?.trim() || null,
        phone: input.phone?.trim() || null,
        established_year: input.established_year || null,
        news_publications: Array.isArray(input.news_publications) ? input.news_publications : [],
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      if (error.code === '23505' && String(error.message || '').includes('slug')) {
        return { error: 'That public URL is already taken by another gallery' };
      }
      return { error: error.message || 'Failed to create profile' };
    }

    // Create a notification for gallery profile creation
    if (input.role === USER_ROLES.GALLERY) {
      try {
        await createNotification({
          userId: user.id,
          type: 'message',
          title: 'Gallery Profile Created',
          message: `Your gallery profile "${input.name.trim()}" has been created successfully. You can now showcase exhibitions and connect with artists.`,
        });
      } catch (notifError) {
        // Don't fail profile creation if notification fails
        console.error('Error creating notification:', notifError);
      }
    }

    revalidatePath('/profile');
    revalidatePath('/profiles');
    revalidatePath(`/artists/${user.id}`);
    revalidatePath('/portal');

    return { success: true, profile: data };
  } catch (error) {
    console.error('Error in createProfile:', error);
    return { error: 'An unexpected error occurred' };
  }
}

