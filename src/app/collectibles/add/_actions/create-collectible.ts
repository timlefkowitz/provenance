'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { artworkImageUploader } from '~/lib/artwork-storage';

/**
 * Create a single collectible with a Certificate of Ownership.
 *
 * Mirrors the artwork add flow (image upload -> certificate number -> insert
 * -> redirect to certificate) but writes to public.collectibles. Collectibles
 * are always owned by the poster, so the certificate is issued "verified"
 * immediately (Certificate of Ownership).
 */
export async function createCollectible(formData: FormData, userId: string) {
  console.log('[Collectibles] createCollectible started', { userId });

  try {
    const client = getSupabaseServerClient();
    const adminClient = getSupabaseServerAdminClient();

    const images = formData.getAll('images') as File[];
    const title = ((formData.get('title') as string) || '').trim();
    const description = (formData.get('description') as string) || '';
    const category = (formData.get('category') as string) || '';
    const subcategory = (formData.get('subcategory') as string) || '';
    const manufacturer = (formData.get('manufacturer') as string) || '';
    const yearRaw = (formData.get('year') as string) || '';
    const condition = (formData.get('condition') as string) || '';
    const gradingService = (formData.get('gradingService') as string) || '';
    const gradingScore = (formData.get('gradingScore') as string) || '';
    const serialNumber = (formData.get('serialNumber') as string) || '';
    const value = (formData.get('value') as string) || '';
    const valueIsPublic = formData.get('valueIsPublic') === 'true';
    const isPublic = formData.get('isPublic') === 'true';
    const locationStr = (formData.get('location') as string) || '';

    const validImages = images.filter((f): f is File => f instanceof File && f.size > 0);
    if (validImages.length === 0) {
      console.error('[Collectibles] createCollectible missing images', { userId });
      return { error: 'At least one photo of the collectible is required' };
    }
    if (!title) {
      return { error: 'A title is required' };
    }

    const year = yearRaw ? parseInt(yearRaw, 10) : null;

    // Ensure account exists (mirrors artwork flow for brand-new users).
    const { data: account, error: accountError } = await client
      .from('accounts')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (accountError || !account) {
      const { error: createAccountError } = await client
        .from('accounts')
        .insert({ id: userId, name: 'User', email: null });
      if (createAccountError) {
        console.error('[Collectibles] account create failed', createAccountError);
        return { error: 'Account not found. Please complete your profile setup first.' };
      }
    }

    console.log('[Collectibles] Uploading collectible images', { userId, category, count: validImages.length });
    const imageUrls: string[] = [];
    for (const img of validImages) {
      const url = await artworkImageUploader.upload(client, adminClient, img, userId);
      imageUrls.push(url);
    }
    console.log('[Collectibles] All images uploaded', { userId, count: imageUrls.length });

    const certificateNumber = await generateCollectibleCertificateNumber(client);

    let locationData: Record<string, unknown> | null = null;
    if (locationStr) {
      try {
        locationData = JSON.parse(locationStr);
      } catch (parseError) {
        console.warn('[Collectibles] location parse failed', parseError);
      }
    }

    const insertData: Record<string, unknown> = {
      account_id: userId,
      title,
      description: description || null,
      category: category || null,
      subcategory: subcategory || null,
      manufacturer: manufacturer || null,
      year: Number.isFinite(year as number) ? year : null,
      condition: condition || null,
      grading_service: gradingService || null,
      grading_score: gradingScore || null,
      serial_number: serialNumber || null,
      image_url: imageUrls[0] ?? null,
      image_urls: imageUrls,
      certificate_number: certificateNumber,
      certificate_status: 'verified',
      status: 'verified',
      is_public: isPublic,
      value: value || null,
      value_is_public: valueIsPublic,
      metadata: locationData ? { certificate_location: locationData } : {},
      created_by: userId,
      updated_by: userId,
    };

    // Use the authenticated client so RLS (account_id = auth.uid()) applies.
    const { data: collectible, error } = await (client as any)
      .from('collectibles')
      .insert(insertData)
      .select('id')
      .single();

    if (error || !collectible) {
      console.error('[Collectibles] insert failed', error);
      const message = error?.message ?? '';
      if (/schema cache/i.test(message) || /value(_is_public)?/i.test(message)) {
        return {
          error:
            'Database migration required: run the collectibles value migration. ' +
            'cd makerkit/nextjs-saas-starter-kit-lite/apps/web && supabase db push',
        };
      }
      return { error: `Failed to create collectible: ${error?.message ?? 'unknown error'}` };
    }

    console.log('[Collectibles] Collectible created', {
      userId,
      collectibleId: collectible.id,
      certificateNumber,
    });

    revalidatePath('/collectibles');
    revalidatePath('/collectibles/my');

    return { collectibleId: collectible.id as string };
  } catch (err) {
    console.error('[Collectibles] createCollectible failed', err);
    return { error: (err as Error)?.message || 'An unexpected error occurred' };
  }
}

async function generateCollectibleCertificateNumber(client: any): Promise<string> {
  try {
    const { data, error } = await client.rpc('generate_collectible_certificate_number');
    if (!error && data) return data as string;
    if (error) {
      console.warn('[Collectibles] generate_collectible_certificate_number RPC failed', error);
    }
  } catch (err) {
    console.warn('[Collectibles] certificate RPC threw, falling back client-side', err);
  }

  // Client-side fallback with uniqueness check against collectibles.
  let attempts = 0;
  while (attempts < 10) {
    const candidate = `PROV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const { data } = await client
      .from('collectibles')
      .select('id')
      .eq('certificate_number', candidate)
      .maybeSingle();
    if (!data) return candidate;
    attempts++;
  }
  throw new Error('Failed to generate a unique certificate number');
}
