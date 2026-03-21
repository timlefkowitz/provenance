'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { sendCertificationEmail } from '~/lib/email';
import { getUserRole, USER_ROLES, getCertificateTypeForRole, isValidRole, type UserRole } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';
import { artworkImageUploader } from '~/lib/artwork-storage';
import { logger } from '~/lib/logger';
import { trackUserStreakActivity } from '~/lib/streak-service';

export async function createArtworksBatch(formData: FormData, userId: string) {
  try {
    const client = getSupabaseServerClient();
    
    // Get form data
    const debugUserAgent = formData.get('debugUserAgent') as string | null;
    const debugPlatform = formData.get('debugPlatform') as string | null;
    const debugViewport = formData.get('debugViewport') as string | null;

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
    const posterRoleRaw = (formData.get('posterRole') as string | null) ?? null;

    const dimensions = formData.get('dimensions') as string || '';
    const formerOwners = formData.get('formerOwners') as string || '';
    const auctionHistory = formData.get('auctionHistory') as string || '';
    const exhibitionHistory = formData.get('exhibitionHistory') as string || '';
    const historicContext = formData.get('historicContext') as string || '';
    const celebrityNotes = formData.get('celebrityNotes') as string || '';
    const value = formData.get('value') as string || '';
    const valueIsPublic = formData.get('valueIsPublic') === 'true';
    const edition = formData.get('edition') as string || '';
    const productionLocation = formData.get('productionLocation') as string || '';
    const ownedBy = formData.get('ownedBy') as string || '';
    const ownedByIsPublic = formData.get('ownedByIsPublic') === 'true';
    const soldBy = formData.get('soldBy') as string || '';
    const soldByIsPublic = formData.get('soldByIsPublic') === 'true';

    logger.info('artwork_post_request_received', {
      userId,
      imageCount: images?.length ?? 0,
      titleCount: titles?.length ?? 0,
      hasDescription: Boolean(description),
      hasArtistName: Boolean(artistName),
      hasMedium: Boolean(medium),
      hasCreationDate: Boolean(creationDate),
      hasExhibitionId: Boolean(exhibitionId),
      hasGalleryProfileId: Boolean(galleryProfileId),
      hasOwnedBy: Boolean(ownedBy.trim()),
      hasSoldBy: Boolean(soldBy.trim()),
      hasAuctionHistory: Boolean(auctionHistory.trim()),
      hasExhibitionHistory: Boolean(exhibitionHistory.trim()),
      posterRole: posterRoleRaw || 'none',
      debugUserAgent,
      debugPlatform,
      debugViewport,
    });

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
        logger.error('create_artworks_batch_account_create_failed', {
          userId,
          error: createAccountError,
        });
        return { error: 'Account not found. Please complete your profile setup first.' };
      }
    }

    // Process all artworks
    const artworkIds: string[] = [];
    const errors: string[] = [];
    
    // Fetch user account info once for email sending and role checking
    let accountEmail: string | null = null;
    let accountName: string | null = null;
    let accountRole: UserRole | null = null;
    let posterRole: UserRole | null = null;
    try {
      const { data: account } = await client
        .from('accounts')
        .select('email, name, public_data')
        .eq('id', userId)
        .single();
      accountEmail = account?.email || null;
      accountName = account?.name || null;
      accountRole = getUserRole(account?.public_data as Record<string, any>);
      if (posterRoleRaw && isValidRole(posterRoleRaw)) {
        posterRole = posterRoleRaw as UserRole;
      }
    } catch (error) {
      logger.error('create_artworks_batch_account_fetch_failed', {
        userId,
        error,
      });
    }

    const effectiveRole: UserRole | null = posterRole ?? accountRole;

    logger.info('artwork_post_start', {
      role: effectiveRole || accountRole || 'unknown',
      accountRole: accountRole || 'none',
      posterRole: posterRole || 'none',
      userId,
      artworkCount: images.length,
      hasExhibition: !!exhibitionId,
      hasGalleryProfile: !!galleryProfileId,
    });

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
        const imageUrl = await artworkImageUploader.upload(client, adminClient, imageFile, userId);

        // Generate certificate number
        const certificateNumber = await generateCertificateNumber(client);

        // Parse location data if available
        let locationData = null;
        if (locationStr) {
          try {
            locationData = JSON.parse(locationStr);
          } catch (parseError) {
            logger.warn('create_artworks_batch_location_parse_failed', {
              index: i,
              locationStr,
              error: parseError,
            });
          }
        }

        // Certificate type by poster: gallery → Certificate of Show, collector → Certificate of Ownership, artist → Certificate of Authenticity
        const certificateType = getCertificateTypeForRole(effectiveRole);
        // If collector or gallery, certificate needs artist claim
        // If artist, certificate is verified immediately
        let certificateStatus = 'verified';
        let artistAccountId: string | null = null;
        
        if (effectiveRole === USER_ROLES.COLLECTOR || effectiveRole === USER_ROLES.GALLERY) {
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
              logger.info('create_artworks_batch_artist_not_found_by_name', {
                userId,
                artistName,
              });
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
          // Provenance fields (filled during initial create)
          dimensions: dimensions || null,
          former_owners: formerOwners || null,
          auction_history: auctionHistory || null,
          exhibition_history: exhibitionHistory || null,
          historic_context: historicContext || null,
          celebrity_notes: celebrityNotes || null,
          value: value || null,
          value_is_public: valueIsPublic,
          edition: edition || null,
          production_location: productionLocation || null,
          owned_by: ownedBy || null,
          owned_by_is_public: ownedByIsPublic,
          sold_by: soldBy || null,
          sold_by_is_public: soldByIsPublic,
        };

        // Try to include is_public, but handle case where migration hasn't been run yet
        insertData.is_public = isPublic;

        // Add gallery_profile_id if provided (for galleries with multiple profiles)
        if (galleryProfileId && effectiveRole === USER_ROLES.GALLERY) {
          // Verify the gallery profile belongs to this user OR user is a gallery member
          try {
            const { data: profile } = await (client as any)
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
                const { data: member } = await (client as any)
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
          logger.error('create_artworks_batch_artwork_insert_failed', {
            index: i,
            userId,
            title,
            error,
          });
          
          // Check if error is about missing provenance columns
          const message = error.message ?? '';
          if (
            /schema cache/i.test(message) ||
            /is_public/i.test(message) ||
            /dimensions/i.test(message) ||
            /former_owners/i.test(message) ||
            /auction_history/i.test(message) ||
            /exhibition_history/i.test(message) ||
            /historic_context/i.test(message) ||
            /celebrity_notes/i.test(message) ||
            /value(_is_public)?/i.test(message) ||
            /edition/i.test(message) ||
            /production_location/i.test(message) ||
            /owned_by/i.test(message) ||
            /sold_by/i.test(message)
          ) {
            errors.push(
              `Database migration required: Please run the migration to add the artwork/provenance columns. ` +
              `Run: cd makerkit/nextjs-saas-starter-kit-lite/apps/web && supabase db push`
            );
          } else {
            errors.push(`Failed to create artwork ${i + 1}: ${error.message}`);
          }
        } else if (artwork) {
          artworkIds.push(artwork.id);
          try {
            console.log('[Streak] Tracking artwork upload activity for streak');
            await trackUserStreakActivity(client, {
              userId,
              activityType: 'artwork_uploaded',
            });
          } catch (streakError) {
            console.error('[Streak] Failed to track upload streak activity', streakError);
            logger.error('create_artworks_batch_streak_track_failed', {
              userId,
              artworkId: artwork.id,
              error: streakError,
            });
          }
          
          // Create unclaimed artist profile in registry if gallery/collector added artwork with artist name
          // and artist doesn't have an account yet
          if ((effectiveRole === USER_ROLES.GALLERY || effectiveRole === USER_ROLES.COLLECTOR) && artistName && !artistAccountId) {
            try {
              // Check if unclaimed profile already exists for this artist name
              const { data: existingProfile } = await (client as any)
                .from('user_profiles')
                .select('id')
                .eq('name', artistName.trim())
                .eq('role', 'artist')
                .eq('is_claimed', false)
                .is('user_id', null)
                .single();
              
              // Only create if it doesn't exist
              if (!existingProfile) {
                const { error: profileError } = await (client as any)
                  .from('user_profiles')
                  .insert({
                    user_id: null, // Unclaimed profile
                    role: 'artist',
                    name: artistName.trim(),
                    medium: medium?.trim() || null,
                    is_claimed: false,
                    created_by_gallery_id: effectiveRole === USER_ROLES.GALLERY ? userId : null,
                    is_active: true,
                  });
                if (profileError && profileError.code !== '23505') {
                  logger.error('create_artworks_batch_unclaimed_profile_insert_failed', {
                    userId,
                    artistName,
                    error: profileError,
                  });
                }
              }
            } catch (profileError) {
              // Don't fail artwork creation if profile creation fails
              logger.error('create_artworks_batch_unclaimed_profile_fatal', {
                userId,
                artistName,
                error: profileError,
              });
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
                  logger.error('create_artworks_batch_exhibition_link_insert_failed', {
                    exhibitionId,
                    artworkId: artwork.id,
                    error: exhibitionInsertError,
                  });
                }
              }
            } catch (exhibitionError) {
              logger.error('create_artworks_batch_exhibition_link_failed', {
                exhibitionId,
                artworkId: artwork.id,
                error: exhibitionError,
              });
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
                logger.error('create_artworks_batch_cert_email_failed', {
                  index: i,
                  userId,
                  email: accountEmail,
                  artworkId: artwork.id,
                  error: emailError,
                });
                // Don't fail the artwork creation if email fails
              });
            } catch (emailError) {
              logger.error('create_artworks_batch_cert_email_block_failed', {
                index: i,
                userId,
                artworkId: artwork.id,
                error: emailError,
              });
              // Don't fail the artwork creation if email fails
            }
          }
        }
      } catch (error: any) {
        logger.error('create_artworks_batch_artwork_fatal', {
          index: i,
          userId,
          fileName: imageFile?.name,
          error,
        });
        errors.push(`Error processing artwork ${i + 1}: ${error?.message || 'Unknown error'}`);
      }
    }

    if (artworkIds.length === 0) {
      logger.error('artwork_post_failed', {
        role: effectiveRole || accountRole || 'unknown',
        userId,
        attemptedCount: images.length,
        errors,
      });
      return { 
        error: errors.length > 0 
          ? `Failed to create artworks: ${errors.join('; ')}`
          : 'Failed to create any artworks'
      };
    }

    if (errors.length > 0) {
      logger.warn('artwork_post_partial', {
        role: effectiveRole || accountRole || 'unknown',
        userId,
        successCount: artworkIds.length,
        failedCount: errors.length,
        errors,
      });
    }

    logger.info('artwork_post_success', {
      role: effectiveRole || accountRole || 'unknown',
      userId,
      artworkIds,
      count: artworkIds.length,
      certificateType: getCertificateTypeForRole(effectiveRole),
    });

    revalidatePath('/artworks');

    return { 
      artworkIds,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    logger.error('artwork_post_fatal', {
      userId,
      message: error?.message ?? String(error),
      stack: error?.stack,
    });
    return { error: 'An unexpected error occurred' };
  }
}

async function generateCertificateNumber(
  client: any,
): Promise<string> {
  try {
    const { data, error } = await client.rpc('generate_certificate_number');
    if (!error && data) {
      return data;
    }
  } catch (error) {
    logger.error('generate_certificate_number_failed', {
      error,
    });
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

