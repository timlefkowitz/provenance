'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { sendCertificationEmail } from '~/lib/email';
import { getUserRole, USER_ROLES, getCertificateTypeForRole } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';
import { uploadArtworkImage as uploadArtworkImageStorage } from '~/lib/artwork-storage';

export async function createArtworksBatch(formData: FormData, userId: string) {
  try {
    const client = getSupabaseServerClient();
    
    // Get form data
    const images = formData.getAll('images') as File[];
    const titles = formData.getAll('titles') as string[];
    const locations = formData.getAll('locations') as string[]; // JSON strings
    const description = formData.get('description') as string || '';
    const artistName = formData.get('artistName') as string || '';
    const medium = formData.get('medium') as string || '';
    const creationDate = formData.get('creationDate') as string || '';
    const isPublic = formData.get('isPublic') === 'true'; // Default to true if not provided
    const exhibitionId = formData.get('exhibitionId') as string || null;
    const galleryProfileId = formData.get('galleryProfileId') as string || null;

    if (!images || images.length === 0) {
      return { error: 'At least one image is required' };
    }

    if (images.length !== titles.length) {
      return { error: 'Each image must have a title' };
    }

    // Ensure account exists
    const { data: account, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('id', userId)
      .single();

    if (accountError || !account) {
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

    // Process all artworks
    const artworkIds: string[] = [];
    const errors: string[] = [];
    
    // Fetch user account info once for email sending and role checking
    let accountEmail: string | null = null;
    let accountName: string | null = null;
    let userRole: string | null = null;
    try {
      const { data: account } = await client
        .from('accounts')
        .select('email, name, public_data')
        .eq('id', userId)
        .single();
      accountEmail = account?.email || null;
      accountName = account?.name || null;
      userRole = getUserRole(account?.public_data as Record<string, any>);
    } catch (error) {
      console.error('Error fetching account for email:', error);
    }

    const adminClient = getSupabaseServerAdminClient();
    for (let i = 0; i < images.length; i++) {
      const imageFile = images[i];
      const title = titles[i];
      const locationStr = locations[i] || '';

      if (!title || !title.trim()) {
        errors.push(`Image ${i + 1} is missing a title`);
        continue;
      }

      try {
        const imageUrl = await uploadArtworkImageStorage(client, adminClient, imageFile, userId);

        // Generate certificate number
        const certificateNumber = await generateCertificateNumber(client);

        // Parse location data if available
        let locationData = null;
        if (locationStr) {
          try {
            locationData = JSON.parse(locationStr);
          } catch (parseError) {
            console.warn('Failed to parse location data:', parseError);
          }
        }

        // Certificate type by poster: gallery → Certificate of Show, collector → Certificate of Ownership, artist → Certificate of Authenticity
        const certificateType = getCertificateTypeForRole(userRole);
        // If collector or gallery, certificate needs artist claim
        // If artist, certificate is verified immediately
        let certificateStatus = 'verified';
        let artistAccountId: string | null = null;
        
        if (userRole === USER_ROLES.COLLECTOR || userRole === USER_ROLES.GALLERY) {
          certificateStatus = 'pending_artist_claim';
          
          // Try to find artist account by name
          if (artistName) {
            try {
              const { data: artistAccount } = await client
                .from('accounts')
                .select('id, public_data')
                .eq('name', artistName)
                .single();
              
              if (artistAccount) {
                const artistAccountRole = getUserRole(artistAccount.public_data as Record<string, any>);
                if (artistAccountRole === USER_ROLES.ARTIST) {
                  artistAccountId = artistAccount.id;
                }
              }
            } catch (error) {
              // Artist not found by name, that's okay - they can claim later
              console.log('Artist account not found by name, will need to claim:', artistName);
            }
          }
        }

        // Create artwork record
        const insertData: any = {
          account_id: userId,
          title: title.trim(),
          description,
          artist_name: artistName,
          medium,
          creation_date: creationDate || null,
          image_url: imageUrl,
          certificate_number: certificateNumber,
          status: 'verified', // Keep status for backward compatibility
          certificate_type: certificateType,
          certificate_status: certificateStatus, // New workflow status
          artist_account_id: artistAccountId,
          created_by: userId,
          updated_by: userId,
          metadata: locationData ? { certificate_location: locationData } : {},
        };

        // Try to include is_public, but handle case where migration hasn't been run yet
        insertData.is_public = isPublic;

        // Add gallery_profile_id if provided (for galleries with multiple profiles)
        if (galleryProfileId && userRole === USER_ROLES.GALLERY) {
          // Verify the gallery profile belongs to this user OR user is a gallery member
          try {
            const { data: profile } = await client
              .from('user_profiles')
              .select('id, user_id, role')
              .eq('id', galleryProfileId)
              .eq('role', USER_ROLES.GALLERY)
              .single();
            
            if (profile) {
              // Check if user owns the profile or is a member
              const isOwner = profile.user_id === userId;
              let isMember = false;
              
              if (!isOwner) {
                const { data: member } = await client
                  .from('gallery_members')
                  .select('id')
                  .eq('gallery_profile_id', galleryProfileId)
                  .eq('user_id', userId)
                  .single();
                
                isMember = !!member;
              }
              
              if (isOwner || isMember) {
                insertData.gallery_profile_id = galleryProfileId;
              }
            }
          } catch (error) {
            console.warn('Invalid gallery profile ID provided, continuing without it:', error);
          }
        }

        const { data: artwork, error } = await (client as any)
          .from('artworks')
          .insert(insertData)
          .select('id')
          .single();

        if (error) {
          console.error(`Error creating artwork ${i + 1}:`, error);
          
          // Check if error is about missing is_public column
          if (error.message?.includes('is_public') || error.message?.includes('schema cache')) {
            errors.push(
              `Database migration required: Please run the migration to add the is_public column. ` +
              `Run: cd makerkit/nextjs-saas-starter-kit-lite/apps/web && supabase db push`
            );
          } else {
            errors.push(`Failed to create artwork ${i + 1}: ${error.message}`);
          }
        } else if (artwork) {
          artworkIds.push(artwork.id);
          
          // Create unclaimed artist profile in registry if gallery/collector added artwork with artist name
          // and artist doesn't have an account yet
          if ((userRole === USER_ROLES.GALLERY || userRole === USER_ROLES.COLLECTOR) && artistName && !artistAccountId) {
            try {
              // Check if unclaimed profile already exists for this artist name
              const { data: existingProfile } = await client
                .from('user_profiles')
                .select('id')
                .eq('name', artistName.trim())
                .eq('role', 'artist')
                .eq('is_claimed', false)
                .is('user_id', null)
                .single();
              
              // Only create if it doesn't exist
              if (!existingProfile) {
                const { error: profileError } = await client
                  .from('user_profiles')
                  .insert({
                    user_id: null, // Unclaimed profile
                    role: 'artist',
                    name: artistName.trim(),
                    medium: medium?.trim() || null,
                    is_claimed: false,
                    created_by_gallery_id: userRole === USER_ROLES.GALLERY ? userId : null,
                    is_active: true,
                  });
                if (profileError && profileError.code !== '23505') {
                  console.error('Error creating unclaimed artist profile:', profileError);
                }
              }
            } catch (profileError) {
              // Don't fail artwork creation if profile creation fails
              console.error('Error creating unclaimed artist profile:', profileError);
            }
          }
          
          // Create notification for artist if collector/gallery posted
          if (certificateStatus === 'pending_artist_claim' && artistAccountId) {
            try {
              await createNotification({
                userId: artistAccountId,
                type: 'certificate_claim_request',
                title: `Certificate Claim Request: ${title.trim()}`,
                message: `${accountName || 'A collector'} has posted an artwork "${title.trim()}" and is requesting you to claim the certificate.`,
                artworkId: artwork.id,
                relatedUserId: userId,
                metadata: {
                  certificateNumber,
                  artistName,
                },
              });
            } catch (notifError) {
              console.error(`Failed to create notification for artist:`, notifError);
              // Don't fail artwork creation if notification fails
            }
          }
          
          // Link artwork to exhibition if provided
          if (exhibitionId && artwork.id) {
            try {
              // Verify user owns this exhibition
              const { data: exhibition } = await (client as any)
                .from('exhibitions')
                .select('gallery_id')
                .eq('id', exhibitionId)
                .single();

              if (exhibition && exhibition.gallery_id === userId) {
                // Add artwork to exhibition
                const { error: exhibitionInsertError } = await (client as any)
                  .from('exhibition_artworks')
                  .insert({
                    exhibition_id: exhibitionId,
                    artwork_id: artwork.id,
                  });
                if (exhibitionInsertError && exhibitionInsertError.code !== '23505') {
                  console.error('Error linking artwork to exhibition:', exhibitionInsertError);
                }
              }
            } catch (exhibitionError) {
              console.error('Error linking artwork to exhibition:', exhibitionError);
              // Don't fail artwork creation if exhibition linking fails
            }
          }
          
          // Send certification email for this artwork (non-blocking)
          if (accountEmail) {
            try {
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
              const artworkUrl = `${siteUrl}/artworks/${artwork.id}`;
              const userName = accountName || accountEmail.split('@')[0] || 'there';

              // Send email asynchronously (don't wait for it)
              sendCertificationEmail(
                accountEmail,
                userName,
                title.trim(),
                certificateNumber,
                artworkUrl,
              ).catch((emailError) => {
                console.error(`Failed to send certification email for artwork ${i + 1}:`, emailError);
                // Don't fail the artwork creation if email fails
              });
            } catch (emailError) {
              console.error(`Error sending certification email for artwork ${i + 1}:`, emailError);
              // Don't fail the artwork creation if email fails
            }
          }
        }
      } catch (error: any) {
        console.error(`Error processing artwork ${i + 1}:`, error);
        errors.push(`Error processing artwork ${i + 1}: ${error.message || 'Unknown error'}`);
      }
    }

    if (artworkIds.length === 0) {
      return { 
        error: errors.length > 0 
          ? `Failed to create artworks: ${errors.join('; ')}`
          : 'Failed to create any artworks'
      };
    }

    if (errors.length > 0) {
      // Some succeeded, some failed
      console.warn('Some artworks failed to create:', errors);
    }

    revalidatePath('/artworks');

    return { 
      artworkIds,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('Error in createArtworksBatch:', error);
    return { error: 'An unexpected error occurred' };
  }
}

async function generateCertificateNumber(
  client: ReturnType<typeof getSupabaseServerClient>,
): Promise<string> {
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

