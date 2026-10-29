'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES, type UserRole } from '~/lib/user-roles';
import {
  canOwnExhibitionAs,
  type ExhibitionOwnerRole,
} from '../_helpers/exhibition-owner-roles';
import { isInstitutionAccount } from '~/lib/institution-account';
import { captureExhibitionContacts } from '~/lib/crm/capture-exhibition-contacts';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import {
  createExhibitionArtistInvites,
  inviteCreditedArtists,
  type ExhibitionArtistInviteInput,
} from './manage-exhibition-invites';
import { exhibitionHasEnded, parseMaxArtworksPerArtist } from '../_helpers/exhibition-invite-limits';

export async function createExhibition(formData: FormData) {
  console.log('[Exhibitions] createExhibition started');
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Authorization: only gallery or institution accounts can create exhibitions.
  const { data: account } = await client
    .from('accounts')
    .select('id, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    throw new Error('Account not found');
  }

  const userRole = getUserRole(account.public_data as Record<string, unknown>);
  const allowedRoles = new Set<UserRole>([
    USER_ROLES.GALLERY,
    USER_ROLES.INSTITUTION,
    USER_ROLES.ARTIST,
    USER_ROLES.COLLECTOR,
  ]);
  if (!userRole || !allowedRoles.has(userRole)) {
    throw new Error('You must have an active role to create an exhibition');
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string | null;
  const location = formData.get('location') as string | null;
  const curator = formData.get('curator') as string | null;
  const theme = formData.get('theme') as string | null;
  const artistIdsJson = formData.get('artistIds') as string | null;
  const artistInvitesJson = formData.get('artistInvites') as string | null;
  const maxArtworksPerArtist = parseMaxArtworksPerArtist(formData.get('maxArtworksPerArtist'));
  const ownerRoleInput = (formData.get('ownerRole') as string | null) || userRole;

  // An account can own exhibitions as an artist or as a gallery/institution
  // independently of its current mode (e.g. an artist who also runs a gallery
  // curating a show outside it). Collector-owned shows require collector mode.
  const institutionLocked = isInstitutionAccount(account.public_data as Record<string, unknown>);
  if (!canOwnExhibitionAs(ownerRoleInput, userRole, institutionLocked)) {
    console.error('[Exhibitions] createExhibition owner role rejected', {
      userRole,
      ownerRoleInput,
    });
    throw new Error('Cannot create an exhibition under that mode');
  }
  const ownerRole = ownerRoleInput as ExhibitionOwnerRole;

  if (!title || !startDate) {
    throw new Error('Title and start date are required');
  }
  if (containsObjectionableText(title, description, location, curator, theme)) {
    throw new Error(OBJECTIONABLE_TEXT_MESSAGE);
  }

  // Parse artist IDs
  let artistIds: string[] = [];
  if (artistIdsJson) {
    try {
      artistIds = JSON.parse(artistIdsJson);
    } catch (e) {
      console.error('Error parsing artist IDs:', e);
    }
  }

  // Build metadata object
  const metadata: Record<string, unknown> = {};
  if (curator?.trim()) {
    metadata.curator = curator.trim();
  }
  if (theme?.trim()) {
    metadata.theme = theme.trim();
  }
  if (maxArtworksPerArtist) {
    metadata.max_artworks_per_artist = maxArtworksPerArtist;
  }

  const { data: exhibition, error } = await asUntyped(client)
    .from('exhibitions')
    .insert({
      gallery_id: user.id,
      owner_role: ownerRole,
      title: title.trim(),
      description: description?.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
      location: location?.trim() || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Exhibitions] createExhibition insert failed', error);
    throw new Error('Failed to create exhibition');
  }
  console.log('[Exhibitions] createExhibition succeeded', {
    exhibitionId: exhibition.id,
    ownerRole,
  });

  // Add artists to exhibition
  if (artistIds.length > 0) {
    const artistInserts = artistIds.map((artistId) => ({
      exhibition_id: exhibition.id,
      artist_account_id: artistId,
    }));

    const { error: artistsError } = await asUntyped(client)
      .from('exhibition_artists')
      .insert(artistInserts);

    if (artistsError) {
      console.error('Error adding artists to exhibition:', artistsError);
      // Don't throw - exhibition was created, artists can be added later
    }
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/artists/${user.id}`);

  const artistNames: string[] = [];
  if (artistIds.length > 0) {
    const { data: artistAccounts } = await client
      .from('accounts')
      .select('name')
      .in('id', artistIds);
    for (const acct of artistAccounts ?? []) {
      if (acct.name) artistNames.push(acct.name);
    }
  }

  await captureExhibitionContacts(user.id, {
    curatorName: curator,
    artistNames,
    exhibitionTitle: title,
  });

  if (artistInvitesJson) {
    try {
      const invites = JSON.parse(artistInvitesJson) as ExhibitionArtistInviteInput[];
      if (invites.length > 0) {
        await createExhibitionArtistInvites(exhibition.id, invites);
      }
    } catch (e) {
      console.error('[Exhibitions] createExhibition artist invites failed', e);
    }
  }

  // Credited platform artists get the same upload invite as emailed ones
  // (skipped for past shows being catalogued after the fact).
  if (artistIds.length > 0 && !exhibitionHasEnded(endDate)) {
    try {
      await inviteCreditedArtists(exhibition.id, artistIds);
    } catch (e) {
      console.error('[Exhibitions] createExhibition credited artist invites failed', e);
    }
  }

  return { success: true, exhibitionId: exhibition.id };
}

