'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createArtworksBatch } from '~/app/artworks/add/_actions/create-artworks-batch';
import { addArtworkAttachment } from '~/app/artworks/[id]/_actions/add-artwork-attachment';
import { createProvenanceUpdateRequest } from '~/app/artworks/[id]/_actions/create-provenance-update-request';
import { markArtworkSold } from '~/app/artworks/[id]/_actions/mark-artwork-sold';
import { updateArtworkPublications } from '~/app/artworks/[id]/certificate/_actions/update-artwork-publications';
import { updateProvenance } from '~/app/artworks/[id]/edit/_actions/update-provenance';
import { updateArtworkImage } from '~/app/artworks/edit-provenance/_actions/update-artwork-image';
import { addArtworkToExhibition } from '~/app/exhibitions/_actions/manage-exhibition-artworks';
import { appendLineIfMissing } from '~/lib/provenance/chain';
import { asUntyped } from '~/lib/supabase-untyped';
import { attachmentToFile, loadTacoAttachment } from '~/lib/taco/attachments';
import {
  APPEND_FIELD_COLUMNS,
  applyEditsToPayload,
  type AppendField,
  type CreateRow,
  type ProposalEdits,
  type ProposalPayload,
  type ProposalPreview,
  type ProposalResult,
  type ProposalStatus,
  yearToDate,
} from '~/lib/taco/proposals';
import { USER_ROLES, getUserRole } from '~/lib/user-roles';

type Loaded = {
  id: string;
  user_id: string;
  kind: string;
  status: ProposalStatus;
  payload: ProposalPayload;
  preview: ProposalPreview;
};

async function loadPending(proposalId: string): Promise<{ userId: string; proposal: Loaded } | { error: string }> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };
  // RLS: users can only select their own proposals.
  const { data } = await asUntyped(client)
    .from('taco_proposals')
    .select('id, user_id, kind, status, payload, preview')
    .eq('id', proposalId)
    .maybeSingle();
  if (!data || data.user_id !== user.id) return { error: 'That suggestion was not found.' };
  if (data.status !== 'pending') return { error: 'That suggestion was already handled.' };
  return { userId: user.id, proposal: data as Loaded };
}

async function finish(id: string, status: ProposalStatus, result: ProposalResult) {
  await asUntyped(getSupabaseServerAdminClient())
    .from('taco_proposals')
    .update({ status, result, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');
}

const view = (id: string) => [{ label: 'View artwork', href: `/artworks/${id}` }];

/** Applies a Taco proposal the user confirmed on a card, via the normal artwork actions. */
export async function applyTacoProposal(
  proposalId: string,
  edits?: ProposalEdits,
): Promise<{ status: ProposalStatus; result: ProposalResult }> {
  const loaded = await loadPending(proposalId);
  if ('error' in loaded) return { status: 'failed', result: { ok: false, message: loaded.error } };
  const { userId, proposal } = loaded;
  const payload = applyEditsToPayload(proposal.payload, proposal.preview, edits);
  console.log('[Taco] applyTacoProposal', { userId, proposalId, kind: payload.kind });

  // Claim it first so a double click can't apply twice.
  const { data: claimed } = await asUntyped(getSupabaseServerAdminClient())
    .from('taco_proposals')
    .update({ status: 'applied', updated_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('status', 'pending')
    .select('id');
  if (!claimed?.length) return { status: 'failed', result: { ok: false, message: 'That suggestion was already handled.' } };
  const release = () =>
    asUntyped(getSupabaseServerAdminClient()).from('taco_proposals').update({ status: 'pending' }).eq('id', proposalId);

  let status: ProposalStatus = 'applied';
  let result: ProposalResult;
  try {
    result = await run(payload, userId);
    if (!result.ok) status = 'failed';
    else if (result.rowErrors && Object.keys(result.rowErrors).length) status = 'partial';
  } catch (err) {
    console.error('[Taco] applyTacoProposal threw', { proposalId, err });
    result = { ok: false, message: err instanceof Error ? err.message : 'Something went wrong.' };
    status = 'failed';
  }

  if (status === 'failed') {
    // Let the user fix it on the card and try again.
    await release();
    await asUntyped(getSupabaseServerAdminClient()).from('taco_proposals').update({ result }).eq('id', proposalId);
    return { status: 'pending', result };
  }
  await asUntyped(getSupabaseServerAdminClient())
    .from('taco_proposals')
    .update({ status, result, updated_at: new Date().toISOString() })
    .eq('id', proposalId);
  revalidatePath('/artworks/my');
  return { status, result };
}

export async function skipTacoProposal(proposalId: string): Promise<{ status: ProposalStatus }> {
  const loaded = await loadPending(proposalId);
  if ('error' in loaded) return { status: 'failed' };
  await finish(proposalId, 'skipped', { ok: true, message: 'Skipped' });
  return { status: 'skipped' };
}

/* -------------------------------------------------------------------------- */

async function run(payload: ProposalPayload, userId: string): Promise<ProposalResult> {
  const admin = getSupabaseServerAdminClient();

  switch (payload.kind) {
    case 'create_artworks':
      return createRows(payload.rows, userId);

    case 'add_photo': {
      const att = await loadTacoAttachment(admin, userId, payload.attachment_id);
      if (!att) return { ok: false, message: 'The photo is no longer available. Drop it again.' };
      const file = await attachmentToFile(admin, att);
      if (payload.role === 'main') {
        const fd = new FormData();
        fd.set('image', file);
        const r = await updateArtworkImage(payload.artwork_id, fd);
        if (!r.success) return { ok: false, message: r.error ?? 'Could not replace the photo.' };
        return {
          ok: true,
          message: r.sentToArtist ? `Photo replaced and sent to ${r.sentToArtist} to approve.` : 'Photo replaced.',
          navigation: view(payload.artwork_id),
        };
      }
      return attach(payload.artwork_id, file, payload.label, payload.is_public, 'Photo added.');
    }

    case 'attach_document': {
      const att = await loadTacoAttachment(admin, userId, payload.attachment_id);
      if (!att) return { ok: false, message: 'The file is no longer available. Drop it again.' };
      const file = await attachmentToFile(admin, att);
      return attach(payload.artwork_id, file, payload.label, payload.is_public, 'Document attached.');
    }

    case 'update_provenance': {
      // Re-read current values so lines are appended to what's there now.
      const { data: current } = await asUntyped(admin)
        .from('artworks')
        .select('former_owners, auction_history, exhibition_history, historic_context, celebrity_notes')
        .eq('id', payload.artwork_id)
        .maybeSingle();
      const update: Parameters<typeof updateProvenance>[1] = { ...payload.set };
      if (payload.set.creationDate) update.creationDate = yearToDate(payload.set.creationDate) ?? undefined;
      for (const key of Object.keys(payload.append) as AppendField[]) {
        let acc = ((current as Record<string, unknown> | null)?.[APPEND_FIELD_COLUMNS[key]] as string | null) ?? '';
        for (const line of payload.append[key] ?? []) acc = appendLineIfMissing(acc, line);
        update[key] = acc;
      }
      const r = (await updateProvenance(payload.artwork_id, update)) as { error?: string } | undefined;
      if (r?.error) return { ok: false, message: r.error };
      return { ok: true, message: 'Provenance updated.', navigation: view(payload.artwork_id) };
    }

    case 'add_to_exhibition': {
      await addArtworkToExhibition(payload.exhibition_id, payload.artwork_id);
      return {
        ok: true,
        message: 'Added to the exhibition.',
        navigation: [{ label: 'View exhibition', href: `/exhibitions/${payload.exhibition_id}` }],
      };
    }

    case 'add_publication': {
      const { data: art } = await asUntyped(admin)
        .from('artworks')
        .select('publications')
        .eq('id', payload.artwork_id)
        .maybeSingle();
      const existing = Array.isArray(art?.publications) ? art.publications : [];
      const r = await updateArtworkPublications(payload.artwork_id, [...existing, ...payload.items]);
      if (!r.success) return { ok: false, message: r.error ?? 'Could not save publications.' };
      return { ok: true, message: 'Publications added.', navigation: view(payload.artwork_id) };
    }

    case 'record_sale': {
      const r = await markArtworkSold({
        artworkId: payload.artwork_id,
        soldTo: { name: payload.buyer_name, email: payload.buyer_email },
        priceCents: payload.price ? Math.round(payload.price * 100) : null,
        currency: payload.currency,
        soldAt: payload.sold_at ? (yearToDate(payload.sold_at) ?? payload.sold_at) : null,
        notes: payload.notes,
        metadata: { source: 'taco' },
      });
      if (!r.success) return { ok: false, message: r.error ?? 'Could not record the sale.' };
      return {
        ok: true,
        message: payload.buyer_email ? 'Sale recorded and the buyer was invited.' : 'Sale recorded.',
        navigation: view(payload.artwork_id),
      };
    }

    case 'provenance_request': {
      const fields: Record<string, string> = {};
      const { data: current } = await asUntyped(getSupabaseServerClient())
        .from('artworks')
        .select('former_owners, auction_history, exhibition_history, historic_context, celebrity_notes')
        .eq('id', payload.artwork_id)
        .maybeSingle();
      for (const key of Object.keys(payload.append) as AppendField[]) {
        const col = APPEND_FIELD_COLUMNS[key];
        let acc = ((current as Record<string, unknown> | null)?.[col] as string | null) ?? '';
        for (const line of payload.append[key] ?? []) acc = appendLineIfMissing(acc, line);
        fields[col] = acc;
      }
      const r = await createProvenanceUpdateRequest(payload.artwork_id, fields, payload.message, payload.request_type);
      if (!r.success) return { ok: false, message: r.error ?? 'Could not send the request.' };
      return { ok: true, message: "Request sent. You'll be notified when the holder responds.", navigation: view(payload.artwork_id) };
    }
  }
}

async function attach(
  artworkId: string,
  file: File,
  label: string | null,
  isPublic: boolean,
  okMessage: string,
): Promise<ProposalResult> {
  const fd = new FormData();
  fd.set('file', file);
  if (label) fd.set('label', label);
  fd.set('is_public', String(isPublic));
  const r = await addArtworkAttachment(artworkId, fd);
  if (!r.success) return { ok: false, message: r.error };
  return { ok: true, message: okMessage, navigation: view(artworkId) };
}

async function createRows(rows: CreateRow[], userId: string): Promise<ProposalResult> {
  if (!rows.length) return { ok: false, message: 'No rows selected.' };
  const admin = getSupabaseServerAdminClient();
  const client = asUntyped(getSupabaseServerClient());

  const { data: account } = await client.from('accounts').select('public_data').eq('id', userId).maybeSingle();
  const isPublic = getUserRole(account?.public_data as Record<string, unknown>) !== USER_ROLES.COLLECTOR;

  const created: string[] = [];
  const rowErrors: Record<number, string> = {};

  for (const [i, row] of rows.entries()) {
    try {
      const att = row.attachment_id ? await loadTacoAttachment(admin, userId, row.attachment_id) : null;
      if (att?.kind === 'image') {
        // Same path as the Add Artwork form: certificate number, artist profile, emails, fingerprints.
        const fd = new FormData();
        fd.append('images', await attachmentToFile(admin, att));
        fd.append('titles', row.title);
        const fields: [string, string | null | undefined][] = [
          ['artistName', row.artist_name],
          ['medium', row.medium],
          ['creationDate', yearToDate(row.year)],
          ['dimensions', row.dimensions],
          ['edition', row.edition],
          ['description', row.description],
          ['value', row.value],
          ['formerOwners', row.former_owners],
          ['exhibitionHistory', row.exhibition_history],
          ['auctionHistory', row.auction_history],
        ];
        for (const [k, v] of fields) if (v) fd.set(k, v);
        fd.set('isPublic', String(isPublic));
        const r = await createArtworksBatch(fd, userId);
        if ('error' in r && r.error) throw new Error(r.error);
        created.push(...((r as { artworkIds?: string[] }).artworkIds ?? []));
      } else {
        // No photo: a private draft to finish later (same as the old create_artwork_draft).
        const { data, error } = await client
          .from('artworks')
          .insert({
            account_id: userId,
            created_by: userId,
            title: row.title,
            artist_name: row.artist_name ?? null,
            medium: row.medium ?? null,
            creation_date: yearToDate(row.year),
            dimensions: row.dimensions ?? null,
            edition: row.edition ?? null,
            description: row.description ?? null,
            value: row.value ?? null,
            former_owners: row.former_owners ?? null,
            exhibition_history: row.exhibition_history ?? null,
            auction_history: row.auction_history ?? null,
            status: 'draft',
            is_public: false,
          })
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Could not save draft');
        created.push(data.id as string);
      }
    } catch (err) {
      rowErrors[i] = err instanceof Error ? err.message : 'Failed';
      console.error('[Taco] create row failed', { userId, row: i, err });
    }
  }

  if (!created.length) {
    return { ok: false, message: Object.values(rowErrors)[0] ?? 'Nothing was added.', rowErrors };
  }
  revalidatePath('/artworks');
  const failed = Object.keys(rowErrors).length;
  return {
    ok: true,
    message: `Added ${created.length} artwork${created.length === 1 ? '' : 's'}${failed ? `; ${failed} failed` : ''}.`,
    navigation:
      created.length === 1 ? view(created[0]!) : [{ label: 'Open my collection', href: '/artworks/my' }],
    rowErrors: failed ? rowErrors : undefined,
  };
}
