'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { slugify } from '~/lib/slug';

export async function createOpenCall(formData: FormData) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  const userRole = getUserRole(account?.public_data as Record<string, any>);
  if (userRole !== USER_ROLES.GALLERY) {
    throw new Error('Only galleries can create open calls');
  }

  const galleryProfileId = (formData.get('galleryProfileId') as string || '').trim();
  const exhibitionTitle = (formData.get('title') as string || '').trim();
  const description = (formData.get('description') as string || '').trim();
  const startDate = (formData.get('startDate') as string || '').trim();
  const endDate = (formData.get('endDate') as string || '').trim();
  const location = (formData.get('location') as string || '').trim();
  const requestedSlug = (formData.get('slug') as string || '').trim();

  if (!galleryProfileId) {
    throw new Error('Gallery profile is required');
  }

  if (!exhibitionTitle || !startDate) {
    throw new Error('Exhibition title and start date are required');
  }

  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('id, user_id, role')
    .eq('id', galleryProfileId)
    .single();

  if (!profile || profile.role !== USER_ROLES.GALLERY) {
    throw new Error('Gallery profile not found');
  }

  const { data: canManage } = await (client as any).rpc('is_gallery_owner_or_admin', {
    p_gallery_profile_id: galleryProfileId,
  });

  if (!canManage) {
    throw new Error('You do not have access to this gallery profile');
  }

  const baseSlug = slugify(requestedSlug || exhibitionTitle);
  if (!baseSlug) {
    throw new Error('Slug is required');
  }

  const slug = await generateUniqueSlug(client, baseSlug);

  const { data: exhibition, error: exhibitionError } = await (client as any)
    .from('exhibitions')
    .insert({
      gallery_id: profile.user_id,
      title: exhibitionTitle,
      description: description || null,
      start_date: startDate,
      end_date: endDate || null,
      location: location || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single();

  if (exhibitionError || !exhibition) {
    console.error('Error creating exhibition for open call:', exhibitionError);
    throw new Error('Failed to create exhibition');
  }

  const { data: openCall, error: openCallError } = await (client as any)
    .from('open_calls')
    .insert({
      exhibition_id: exhibition.id,
      gallery_profile_id: galleryProfileId,
      slug,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single();

  if (openCallError || !openCall) {
    console.error('Error creating open call:', openCallError);
    throw new Error('Failed to create open call');
  }

  revalidatePath('/open-calls');
  revalidatePath('/exhibitions');

  return { openCallId: openCall.id, slug };
}

async function generateUniqueSlug(client: ReturnType<typeof getSupabaseServerClient>, baseSlug: string) {
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const { data } = await (client as any)
      .from('open_calls')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
