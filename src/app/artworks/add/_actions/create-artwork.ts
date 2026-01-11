'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { sendCertificationEmail } from '~/lib/email';

const ARTWORKS_BUCKET = 'artworks';

export async function createArtwork(formData: FormData, userId: string) {
  try {
    const client = getSupabaseServerClient();
    
    // Get form data
    const imageFile = formData.get('image') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const artistName = formData.get('artistName') as string || '';
    const medium = formData.get('medium') as string || '';

    if (!imageFile || !title) {
      return { error: 'Title and image are required' };
    }

    // Ensure account exists (should be created by trigger, but verify)
    const { data: account, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('id', userId)
      .single();

    if (accountError || !account) {
      // Account doesn't exist, try to create it
      const { data: newAccount, error: createAccountError } = await client
        .from('accounts')
        .insert({
          id: userId,
          name: 'User',
          email: null,
        })
        .select('id')
        .single();

      if (createAccountError || !newAccount) {
        console.error('Error creating/finding account:', createAccountError);
        return { error: 'Account not found. Please complete your profile setup first.' };
      }
    }

    // Upload image to Supabase Storage
    let imageUrl: string;
    try {
      imageUrl = await uploadArtworkImage(client, imageFile, userId) || '';
      if (!imageUrl) {
        return { error: 'Failed to upload image: No URL returned' };
      }
    } catch (uploadError: any) {
      console.error('Upload error:', uploadError);
      return { error: uploadError?.message || 'Failed to upload image. Please check that the storage bucket exists.' };
    }

    // Generate certificate number
    const certificateNumber = await generateCertificateNumber(client);

    // Create artwork record
    const { data: artwork, error } = await (client as any)
      .from('artworks')
      .insert({
        account_id: userId,
        title,
        description,
        artist_name: artistName,
        medium,
        image_url: imageUrl,
        certificate_number: certificateNumber,
        status: 'verified',
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating artwork:', error);
      return { error: error.message || 'Failed to create artwork' };
    }

    revalidatePath('/artworks');
    revalidatePath(`/artworks/${artwork.id}`);

    // Send certification email (non-blocking)
    try {
      // Get user email and name for the email
      const { data: account } = await client
        .from('accounts')
        .select('email, name')
        .eq('id', userId)
        .single();

      if (account?.email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const artworkUrl = `${siteUrl}/artworks/${artwork.id}`;
        const userName = account.name || account.email.split('@')[0] || 'there';

        // Send email asynchronously (don't wait for it)
        sendCertificationEmail(
          account.email,
          userName,
          title,
          certificateNumber,
          artworkUrl,
        ).catch((emailError) => {
          console.error('Failed to send certification email:', emailError);
          // Don't fail the artwork creation if email fails
        });
      }
    } catch (emailError) {
      console.error('Error sending certification email:', emailError);
      // Don't fail the artwork creation if email fails
    }

    return { artworkId: artwork.id };
  } catch (error) {
    console.error('Error in createArtwork:', error);
    return { error: 'An unexpected error occurred' };
  }
}

async function uploadArtworkImage(
  client: ReturnType<typeof getSupabaseServerClient>,
  file: File,
  userId: string,
): Promise<string | null> {
  try {
    // Ensure bucket exists using admin client
    const adminClient = getSupabaseServerAdminClient();
    const { data: buckets } = await adminClient.storage.listBuckets();
    
    const bucketExists = buckets?.some(b => b.id === ARTWORKS_BUCKET);
    
    if (!bucketExists) {
      // Create the bucket using admin client
      const { error: createError } = await adminClient.storage.createBucket(ARTWORKS_BUCKET, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
        // If bucket creation fails, it might already exist or we don't have permissions
        // Continue and try to upload anyway
      }
    }

    const bytes = await file.arrayBuffer();
    const bucket = client.storage.from(ARTWORKS_BUCKET);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

    const { data: uploadData, error: uploadError } = await bucket.upload(fileName, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      // Return more specific error information
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error('Storage bucket not found. Please run the database migration to create the artworks bucket.');
      }
      throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
    }

    const { data: urlData } = bucket.getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadArtworkImage:', error);
    throw error; // Re-throw to get better error messages
  }
}

async function generateCertificateNumber(
  client: ReturnType<typeof getSupabaseServerClient>,
): Promise<string> {
  // Try to use the database function, fallback to client-side generation
  try {
    const { data, error } = await client.rpc('generate_certificate_number');
    if (!error && data) {
      return data;
    }
  } catch (error) {
    console.error('Error calling generate_certificate_number:', error);
  }

  // Fallback: generate client-side
  let certificateNumber: string;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    certificateNumber = `PROV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const { data } = await client
      .from('artworks')
      .select('id')
      .eq('certificate_number', certificateNumber)
      .single();
    
    exists = !!data;
    attempts++;
  }

  if (exists) {
    throw new Error('Failed to generate unique certificate number');
  }

  return certificateNumber!;
}
