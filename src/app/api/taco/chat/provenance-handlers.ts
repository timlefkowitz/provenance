import OpenAI from 'openai';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canEditGalleryArtworks, canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { embedImageUrl } from '~/lib/image-fingerprint/embed';
import { rankMatches, toPgVector } from '~/lib/image-fingerprint/similarity';
import { appendLineIfMissing } from '~/lib/provenance/chain';
import { asUntyped } from '~/lib/supabase-untyped';
import { loadTacoAttachment, type TacoAttachment } from '~/lib/taco/attachments';
import {
  normalizeExtractedProvenance,
  PROVENANCE_EXTRACTION_PROMPT,
} from '~/lib/taco/extract-provenance-document';
import {
  APPEND_FIELD_COLUMNS,
  APPEND_FIELDS,
  cleanAppend,
  cleanCreateRows,
  cleanSet,
  cleanText,
  isUuid,
  SET_FIELD_COLUMNS,
  SET_FIELDS,
  type AppendField,
  type ProposalChange,
  type ProposalPayload,
  type ProposalPreview,
  type SetField,
  type TacoProposalView,
} from '~/lib/taco/proposals';

const ARTWORK_COLUMNS =
  'id, title, artist_name, image_url, account_id, gallery_profile_id, is_public, status, certificate_type, certificate_number, medium, dimensions, creation_date, edition, description, former_owners, auction_history, exhibition_history, historic_context, celebrity_notes, publications, owned_by, is_sold';

type ArtworkRow = Record<string, unknown> & {
  id: string;
  title: string | null;
  image_url: string | null;
  account_id: string;
  gallery_profile_id: string | null;
};

type Access = { artwork: ArtworkRow; canEdit: boolean };

/**
 * Loads an artwork the user can see (RLS via the user client), falling back to
 * the admin client only for works the user can edit (gallery team members).
 */
async function loadArtworkAccess(artworkId: unknown, userId: string): Promise<Access | { error: string }> {
  if (!isUuid(artworkId)) return { error: 'artwork_id must be an artwork id from search or matching results.' };
  const client = asUntyped(getSupabaseServerClient());
  const { data: visible } = await client.from('artworks').select(ARTWORK_COLUMNS).eq('id', artworkId).maybeSingle();
  let artwork = visible as ArtworkRow | null;
  if (!artwork) {
    const { data: viaAdmin } = await asUntyped(getSupabaseServerAdminClient())
      .from('artworks')
      .select(ARTWORK_COLUMNS)
      .eq('id', artworkId)
      .maybeSingle();
    if (
      viaAdmin &&
      (await canEditGalleryArtworks(userId, {
        account_id: viaAdmin.account_id as string,
        gallery_profile_id: (viaAdmin.gallery_profile_id as string | null) ?? undefined,
      }))
    ) {
      artwork = viaAdmin as ArtworkRow;
    }
  }
  if (!artwork) return { error: 'Artwork not found.' };
  const canEdit = await canEditGalleryArtworks(userId, {
    account_id: artwork.account_id,
    gallery_profile_id: artwork.gallery_profile_id ?? undefined,
  });
  return { artwork, canEdit };
}

const artworkHref = (id: string) => `/artworks/${id}`;

/* -------------------------------------------------------------------------- */
/*  find_matching_artworks                                                    */
/* -------------------------------------------------------------------------- */

type Candidate = {
  artwork_id: string;
  title: string;
  artist_name: string | null;
  year: string | null;
  image_url: string | null;
  owner: 'mine' | 'someone_else';
  matched_by: ('title' | 'image')[];
  confidence: 'strong' | 'likely' | 'weak';
  title_similarity?: number;
  image_similarity?: number;
  href: string;
};

function titleConfidence(titleSim: number, artistSim: number | null): Candidate['confidence'] {
  if (titleSim >= 0.85 && (artistSim === null || artistSim >= 0.6)) return 'strong';
  if (titleSim >= 0.6 && (artistSim === null || artistSim >= 0.4)) return 'likely';
  return 'weak';
}

const RANK: Record<Candidate['confidence'], number> = { strong: 3, likely: 2, weak: 1 };

export async function findMatchesForItem(
  item: { title?: string | null; artist_name?: string | null; attachment?: TacoAttachment | null },
  userId: string,
  limit = 5,
): Promise<Candidate[]> {
  const client = asUntyped(getSupabaseServerClient());
  const byId = new Map<string, Candidate>();
  const rows = new Map<string, Record<string, unknown>>();

  const title = cleanText(item.title, 255);
  if (title && title.length >= 2) {
    const { data, error } = await client.rpc('match_artworks_by_title', {
      q_title: title,
      q_artist: cleanText(item.artist_name, 255),
      match_count: 8,
    });
    if (error) console.error('[Taco] match_artworks_by_title failed', error);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const titleSim = Number(r.title_sim ?? 0);
      const artistSim = r.artist_sim === null || r.artist_sim === undefined ? null : Number(r.artist_sim);
      const confidence = titleConfidence(titleSim, artistSim);
      if (titleSim < 0.35) continue;
      const id = r.artwork_id as string;
      rows.set(id, r);
      byId.set(id, {
        artwork_id: id,
        title: (r.title as string) || 'Untitled',
        artist_name: (r.artist_name as string | null) ?? null,
        year: r.creation_date ? String(r.creation_date).slice(0, 4) : null,
        image_url: (r.image_url as string | null) ?? null,
        owner: 'someone_else',
        matched_by: ['title'],
        confidence,
        title_similarity: Number(titleSim.toFixed(2)),
        href: artworkHref(id),
      });
    }
  }

  if (item.attachment?.kind === 'image') {
    try {
      const embedding = await embedImageUrl(item.attachment.public_url);
      const { data: hits, error } = await client.rpc('match_artworks_by_image', {
        query_embedding: toPgVector(embedding),
        match_count: 6,
        filter_exhibition_id: null,
      });
      if (error) console.error('[Taco] match_artworks_by_image failed', error);
      const ranked = rankMatches(
        ((hits ?? []) as { artwork_id: string; similarity: number }[]).map((h) => ({
          artworkId: h.artwork_id,
          similarity: Number(h.similarity),
        })),
        { limit: 5 },
      );
      const missing = ranked.map((r) => r.artworkId).filter((id) => !rows.has(id));
      if (missing.length) {
        const { data: arts } = await client
          .from('artworks')
          .select('id, title, artist_name, creation_date, image_url, account_id, gallery_profile_id')
          .in('id', missing);
        for (const a of (arts ?? []) as Record<string, unknown>[]) rows.set(a.id as string, { ...a, artwork_id: a.id });
      }
      ranked.forEach((r) => {
        const row = rows.get(r.artworkId);
        if (!row) return;
        const conf = r.confidence;
        const existing = byId.get(r.artworkId);
        if (existing) {
          existing.matched_by.push('image');
          existing.image_similarity = Number(r.similarity.toFixed(2));
          if (RANK[conf] > RANK[existing.confidence]) existing.confidence = conf;
          // Title and image agreeing is as strong as it gets.
          if (existing.confidence === 'likely') existing.confidence = 'strong';
        } else {
          byId.set(r.artworkId, {
            artwork_id: r.artworkId,
            title: (row.title as string) || 'Untitled',
            artist_name: (row.artist_name as string | null) ?? null,
            year: row.creation_date ? String(row.creation_date).slice(0, 4) : null,
            image_url: (row.image_url as string | null) ?? null,
            owner: 'someone_else',
            matched_by: ['image'],
            confidence: conf,
            image_similarity: Number(r.similarity.toFixed(2)),
            href: artworkHref(r.artworkId),
          });
        }
      });
    } catch (err) {
      console.error('[Taco] image matching failed', err);
    }
  }

  const candidates = [...byId.values()]
    .sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || (b.title_similarity ?? 0) - (a.title_similarity ?? 0))
    .slice(0, limit);

  for (const c of candidates) {
    const r = rows.get(c.artwork_id);
    if (!r) continue;
    const mine = await canEditGalleryArtworks(userId, {
      account_id: r.account_id as string,
      gallery_profile_id: (r.gallery_profile_id as string | null) ?? undefined,
    });
    c.owner = mine ? 'mine' : 'someone_else';
  }
  return candidates;
}

export async function handleFindMatchingArtworks(
  args: { items?: { title?: string; artist_name?: string; year?: string; attachment_id?: string }[] },
  userId: string,
): Promise<unknown> {
  const items = (Array.isArray(args.items) ? args.items : []).slice(0, 25);
  if (!items.length) return { error: 'Pass at least one item with a title or an image attachment_id.' };
  const admin = getSupabaseServerAdminClient();

  const results = [];
  for (const [i, item] of items.entries()) {
    const attachment = item.attachment_id ? await loadTacoAttachment(admin, userId, item.attachment_id) : null;
    if (!item.title && !attachment) {
      results.push({ index: i, error: 'Needs a title or an image attachment_id.' });
      continue;
    }
    const candidates = await findMatchesForItem({ ...item, attachment }, userId);
    results.push({
      index: i,
      query: { title: item.title ?? null, artist_name: item.artist_name ?? null, attachment: attachment?.name ?? null },
      already_on_provenance: candidates.some((c) => c.confidence !== 'weak'),
      candidates,
    });
  }
  console.log('[Taco] find_matching_artworks', { userId, count: items.length });
  return {
    results,
    note: 'owner "mine" = the user can edit it (propose changes). "someone_else" = only propose_provenance_request. Weak matches are probably different works.',
  };
}

/* -------------------------------------------------------------------------- */
/*  extract_from_document                                                     */
/* -------------------------------------------------------------------------- */

export async function handleExtractFromDocument(
  args: { attachment_id?: string },
  userId: string,
  apiKey: string,
): Promise<unknown> {
  const admin = getSupabaseServerAdminClient();
  const att = await loadTacoAttachment(admin, userId, args.attachment_id);
  if (!att) return { error: 'Attachment not found. Use an [att:…] id from this conversation.' };

  const openai = new OpenAI({ apiKey });
  let content: OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content'];
  let model = 'gpt-4o-mini';
  if (att.kind === 'image') {
    model = 'gpt-4o';
    content = [
      { type: 'text', text: 'Extract provenance from this photo of a document or label.' },
      { type: 'image_url', image_url: { url: att.public_url, detail: 'high' } },
    ];
  } else if (att.extracted_text && att.extracted_text.trim().length > 20) {
    content = `Document "${att.name}":\n\n${att.extracted_text.slice(0, 40_000)}`;
  } else {
    return {
      error:
        'That file has no readable text (probably a scan). Ask the user to drop a photo or screenshot of it instead.',
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: PROVENANCE_EXTRACTION_PROMPT },
        { role: 'user', content },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const extracted = normalizeExtractedProvenance(JSON.parse(raw));
    console.log('[Taco] extract_from_document', {
      userId,
      attachment: att.id,
      docType: extracted.doc_type,
      artworks: extracted.artworks.length,
      events: extracted.events.length,
    });
    return {
      attachment_id: att.id,
      ...extracted,
      next_step:
        'Run find_matching_artworks on these artworks before proposing. Works that already exist get propose_update_provenance / propose_attach_document; new ones go in one propose_create_artworks.',
    };
  } catch (err) {
    console.error('[Taco] extract_from_document failed', err);
    return { error: 'Could not read that document.' };
  }
}

/* -------------------------------------------------------------------------- */
/*  get_artwork_details                                                       */
/* -------------------------------------------------------------------------- */

export async function handleGetArtworkDetails(args: { artwork_id?: string }, userId: string): Promise<unknown> {
  const access = await loadArtworkAccess(args.artwork_id, userId);
  if ('error' in access) return access;
  const a = access.artwork;
  const { data: attachments } = await asUntyped(getSupabaseServerClient())
    .from('artwork_attachments')
    .select('file_name, file_type, label')
    .eq('artwork_id', a.id)
    .limit(30);
  return {
    artwork_id: a.id,
    can_edit: access.canEdit,
    title: a.title,
    artist_name: a.artist_name,
    medium: a.medium,
    dimensions: a.dimensions,
    date: a.creation_date,
    edition: a.edition,
    status: a.status,
    certificate_type: a.certificate_type,
    owned_by: a.owned_by,
    is_sold: a.is_sold,
    former_owners: a.former_owners,
    auction_history: a.auction_history,
    exhibition_history: a.exhibition_history,
    historic_context: a.historic_context,
    celebrity_notes: a.celebrity_notes,
    publications: a.publications,
    attachments: attachments ?? [],
    href: artworkHref(a.id),
  };
}

/* -------------------------------------------------------------------------- */
/*  Proposals                                                                 */
/* -------------------------------------------------------------------------- */

async function saveProposal(
  userId: string,
  payload: ProposalPayload,
  preview: ProposalPreview,
): Promise<TacoProposalView | { error: string }> {
  const { data, error } = await asUntyped(getSupabaseServerAdminClient())
    .from('taco_proposals')
    .insert({ user_id: userId, kind: payload.kind, payload, preview, status: 'pending' })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[Taco] saveProposal failed', error);
    return { error: 'Could not prepare that change.' };
  }
  console.log('[Taco] proposal created', { userId, id: data.id, kind: payload.kind });
  return { id: data.id as string, kind: payload.kind, status: 'pending', preview };
}

const artworkSummary = (a: ArtworkRow) => ({ id: a.id, title: a.title || 'Untitled', image_url: a.image_url });

function str(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : String(v);
}

/** Drops append lines already present, so the card only shows real additions. */
function newLinesOnly(current: unknown, lines: string[]): string[] {
  let acc = str(current) ?? '';
  const added: string[] = [];
  for (const line of lines) {
    const next = appendLineIfMissing(acc, line);
    if (next !== acc) {
      added.push(line);
      acc = next;
    }
  }
  return added;
}

export type ProposeResult = { view: TacoProposalView; forModel: unknown } | { error: string };

function done(view: TacoProposalView | { error: string }, extra?: Record<string, unknown>): ProposeResult {
  if ('error' in view) return view;
  return {
    view,
    forModel: {
      proposal_id: view.id,
      shown_to_user: true,
      note: 'A confirm card is now shown to the user. Nothing is saved until they click Apply. Briefly say what the card will do.',
      ...extra,
    },
  };
}

async function editableOrError(artworkId: unknown, userId: string): Promise<{ artwork: ArtworkRow } | { error: string }> {
  const access = await loadArtworkAccess(artworkId, userId);
  if ('error' in access) return access;
  if (!access.canEdit) {
    return {
      error:
        "The user can't edit this artwork (someone else holds it). Use propose_provenance_request instead.",
    };
  }
  return { artwork: access.artwork };
}

export async function proposeCreateArtworks(args: { rows?: unknown }, userId: string): Promise<ProposeResult> {
  const rows = cleanCreateRows(args.rows);
  if (!rows.length) return { error: 'Each row needs at least a title.' };
  const admin = getSupabaseServerAdminClient();

  const previewRows: NonNullable<ProposalPreview['rows']> = [];
  const attachments: NonNullable<ProposalPreview['attachments']> = [];
  for (const row of rows) {
    const att = row.attachment_id ? await loadTacoAttachment(admin, userId, row.attachment_id) : null;
    if (row.attachment_id && (!att || att.kind !== 'image')) row.attachment_id = null;
    // Dedup: only check the first 40 rows so a huge checklist stays fast.
    if (previewRows.length < 40) {
      const [top] = await findMatchesForItem({ title: row.title, artist_name: row.artist_name, attachment: att }, userId, 1);
      if (top && top.confidence !== 'weak') {
        row.match = { artwork_id: top.artwork_id, title: top.title, confidence: top.confidence, mine: top.owner === 'mine' };
      }
    }
    previewRows.push({ ...row, image_url: att?.public_url ?? null });
    if (att) attachments.push({ name: att.name, url: att.public_url, kind: 'image' });
  }

  const n = rows.length;
  const dupes = rows.filter((r) => r.match).length;
  const preview: ProposalPreview = {
    title: n === 1 ? `Add "${rows[0]!.title}"` : `Add ${n} artworks`,
    summary:
      (rows.some((r) => !r.attachment_id) ? 'Works without a photo are saved as private drafts. ' : '') +
      (dupes ? `${dupes} look like works already on Provenance and are unticked.` : ''),
    changes: [],
    rows: previewRows,
    attachments,
    apply_label: n === 1 ? 'Add artwork' : 'Add selected',
  };
  return done(await saveProposal(userId, { kind: 'create_artworks', rows }, preview), {
    possible_duplicates: rows.flatMap((r, i) => (r.match ? [{ row: i, ...r.match }] : [])),
  });
}

export async function proposeAddPhoto(
  args: { artwork_id?: string; attachment_id?: string; role?: string; label?: string; is_public?: boolean },
  userId: string,
): Promise<ProposeResult> {
  const target = await editableOrError(args.artwork_id, userId);
  if ('error' in target) return target;
  const att = await loadTacoAttachment(getSupabaseServerAdminClient(), userId, args.attachment_id);
  if (!att || att.kind !== 'image') return { error: 'attachment_id must be an image the user dropped.' };
  const role = args.role === 'main' ? 'main' : 'attachment';
  const label = cleanText(args.label, 200);
  const isPublic = args.is_public !== false;
  const a = target.artwork;
  const changes: ProposalChange[] =
    role === 'main'
      ? [{ key: 'image', label: 'Main photo', before: a.image_url ? 'Current photo' : null, after: att.name, editable: false }]
      : [
          { key: 'label', label: 'Extra photo label', before: null, after: label ?? att.name, editable: true },
          { key: 'visibility', label: 'Visibility', before: null, after: isPublic ? 'Public' : 'Private', editable: false },
        ];
  const preview: ProposalPreview = {
    title: role === 'main' ? `Replace the photo of "${a.title}"` : `Add a photo to "${a.title}"`,
    summary: '',
    artwork: artworkSummary(a),
    changes,
    attachments: [{ name: att.name, url: att.public_url, kind: 'image' }],
    apply_label: role === 'main' ? 'Replace photo' : 'Add photo',
  };
  return done(
    await saveProposal(
      userId,
      { kind: 'add_photo', artwork_id: a.id, attachment_id: att.id, role, label, is_public: isPublic },
      preview,
    ),
  );
}

export async function proposeAttachDocument(
  args: { artwork_id?: string; attachment_id?: string; label?: string; is_public?: boolean },
  userId: string,
): Promise<ProposeResult> {
  const target = await editableOrError(args.artwork_id, userId);
  if ('error' in target) return target;
  const att = await loadTacoAttachment(getSupabaseServerAdminClient(), userId, args.attachment_id);
  if (!att) return { error: 'Attachment not found.' };
  if (att.kind === 'document' && att.mime !== 'application/pdf') {
    return { error: 'Only PDFs and photos can be attached to an artwork. Ask for a PDF version.' };
  }
  const label = cleanText(args.label, 200) ?? att.name;
  const isPublic = args.is_public === true; // documents default to private
  const a = target.artwork;
  const preview: ProposalPreview = {
    title: `Attach "${att.name}" to "${a.title}"`,
    summary: isPublic ? 'Visible on the public certificate.' : 'Private: only you and your team can see it.',
    artwork: artworkSummary(a),
    changes: [
      { key: 'label', label: 'Label', before: null, after: label, editable: true },
      { key: 'visibility', label: 'Visibility', before: null, after: isPublic ? 'Public' : 'Private', editable: false },
    ],
    attachments: [{ name: att.name, url: att.public_url, kind: att.kind }],
    apply_label: 'Attach',
  };
  return done(
    await saveProposal(
      userId,
      { kind: 'attach_document', artwork_id: a.id, attachment_id: att.id, label, is_public: isPublic },
      preview,
    ),
  );
}

export async function proposeUpdateProvenance(
  args: { artwork_id?: string; set?: unknown; append?: unknown },
  userId: string,
): Promise<ProposeResult> {
  const target = await editableOrError(args.artwork_id, userId);
  if ('error' in target) return target;
  const a = target.artwork;

  const set = cleanSet(args.set);
  const append = cleanAppend(args.append);
  const changes: ProposalChange[] = [];

  for (const key of Object.keys(set) as SetField[]) {
    const before = str(a[SET_FIELD_COLUMNS[key]]);
    const beforeCmp = key === 'creationDate' ? before?.slice(0, 10) : before;
    if ((beforeCmp ?? '').toLowerCase() === set[key]!.toLowerCase()) {
      delete set[key];
      continue;
    }
    changes.push({ key: `set.${key}`, label: SET_FIELDS[key], before, after: set[key]!, editable: true });
  }
  for (const key of Object.keys(append) as AppendField[]) {
    const current = a[APPEND_FIELD_COLUMNS[key]];
    const added = newLinesOnly(current, append[key]!);
    if (!added.length) {
      delete append[key];
      continue;
    }
    append[key] = added;
    changes.push({
      key: `append.${key}`,
      label: `Add to ${APPEND_FIELDS[key].toLowerCase()}`,
      before: str(current),
      after: added.join('\n'),
      editable: true,
    });
  }
  if (!changes.length) return { error: 'Nothing new: the artwork already has all of this.' };

  const preview: ProposalPreview = {
    title: `Update provenance of "${a.title}"`,
    summary: 'Changes are mirrored to linked certificates, as with a normal edit.',
    artwork: artworkSummary(a),
    changes,
    apply_label: 'Apply changes',
  };
  return done(await saveProposal(userId, { kind: 'update_provenance', artwork_id: a.id, set, append }, preview));
}

export async function proposeAddToExhibition(
  args: { artwork_id?: string; exhibition_id?: string },
  userId: string,
): Promise<ProposeResult> {
  const target = await editableOrError(args.artwork_id, userId);
  if ('error' in target) return target;
  if (!isUuid(args.exhibition_id)) {
    return { error: 'exhibition_id must come from list_my_exhibitions. For other shows use propose_update_provenance with append.exhibitionHistory.' };
  }
  const { data: ex } = await asUntyped(getSupabaseServerClient())
    .from('exhibitions')
    .select('id, title, gallery_id, start_date, location')
    .eq('id', args.exhibition_id)
    .maybeSingle();
  if (!ex || !(await canManageExhibition(userId, ex.gallery_id as string))) {
    return { error: "Exhibition not found or the user can't manage it." };
  }
  const a = target.artwork;
  const preview: ProposalPreview = {
    title: `Add "${a.title}" to ${ex.title}`,
    summary: [ex.location, ex.start_date].filter(Boolean).join(' · '),
    artwork: artworkSummary(a),
    changes: [{ key: 'exhibition', label: 'Exhibition', before: null, after: ex.title as string, editable: false }],
    apply_label: 'Add to exhibition',
  };
  return done(
    await saveProposal(userId, { kind: 'add_to_exhibition', artwork_id: a.id, exhibition_id: ex.id as string }, preview),
  );
}

export async function proposeAddPublication(
  args: { artwork_id?: string; items?: unknown },
  userId: string,
): Promise<ProposeResult> {
  const target = await editableOrError(args.artwork_id, userId);
  if ('error' in target) return target;
  const a = target.artwork;
  const existing = Array.isArray(a.publications) ? (a.publications as { title?: string }[]) : [];
  const have = new Set(existing.map((p) => (p.title ?? '').toLowerCase()));
  const items = (Array.isArray(args.items) ? args.items : [])
    .slice(0, 20)
    .map((raw) => {
      const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const url = cleanText(o.url, 500);
      return {
        title: cleanText(o.title, 300) ?? '',
        publication_name: cleanText(o.publication_name, 200),
        url: url && /^https?:\/\//i.test(url) ? url : null,
        date: cleanText(o.date, 40),
      };
    })
    .filter((p) => p.title && !have.has(p.title.toLowerCase()));
  if (!items.length) return { error: 'No new publications (each needs a title, and duplicates are skipped).' };
  const preview: ProposalPreview = {
    title: `Add ${items.length === 1 ? 'a publication' : `${items.length} publications`} to "${a.title}"`,
    summary: '',
    artwork: artworkSummary(a),
    changes: items.map((p, i) => ({
      key: `pub.${i}`,
      label: 'Publication',
      before: null,
      after: [p.title, p.publication_name, p.date].filter(Boolean).join(' · '),
      editable: false,
    })),
    apply_label: 'Add',
  };
  return done(await saveProposal(userId, { kind: 'add_publication', artwork_id: a.id, items }, preview));
}

export async function proposeRecordSale(
  args: { artwork_id?: string; buyer_name?: string; buyer_email?: string; price?: number | string; currency?: string; sold_at?: string; notes?: string },
  userId: string,
): Promise<ProposeResult> {
  const target = await editableOrError(args.artwork_id, userId);
  if ('error' in target) return target;
  const a = target.artwork;
  const priceNum = args.price === undefined || args.price === null ? null : Number(String(args.price).replace(/[^0-9.]/g, ''));
  const price = priceNum && Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null;
  const email = cleanText(args.buyer_email, 200);
  const payload: ProposalPayload = {
    kind: 'record_sale',
    artwork_id: a.id,
    buyer_name: cleanText(args.buyer_name, 200),
    buyer_email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    price,
    currency: cleanText(args.currency, 8)?.toUpperCase() ?? null,
    sold_at: cleanText(args.sold_at, 40),
    notes: cleanText(args.notes, 1000),
  };
  const preview: ProposalPreview = {
    title: `Record the sale of "${a.title}"`,
    summary: payload.buyer_email
      ? `${payload.buyer_email} will be invited to claim the Certificate of Ownership.`
      : 'Adds the sale to the provenance record and sales ledger.',
    artwork: artworkSummary(a),
    changes: [
      { key: 'buyer_name', label: 'Buyer', before: null, after: payload.buyer_name ?? '', editable: true },
      { key: 'price', label: `Price${payload.currency ? ` (${payload.currency})` : ''}`, before: null, after: price ? String(price) : '', editable: true },
      { key: 'sold_at', label: 'Date', before: null, after: payload.sold_at ?? '', editable: true },
    ],
    apply_label: 'Record sale',
  };
  return done(await saveProposal(userId, payload, preview));
}

export async function proposeProvenanceRequest(
  args: { artwork_id?: string; request_type?: string; append?: unknown; message?: string },
  userId: string,
): Promise<ProposeResult> {
  const access = await loadArtworkAccess(args.artwork_id, userId);
  if ('error' in access) return access;
  if (access.canEdit) return { error: 'The user can edit this artwork directly; use propose_update_provenance.' };
  const a = access.artwork;
  const requestType = args.request_type === 'ownership_request' ? 'ownership_request' : 'provenance_update';
  const append = cleanAppend(args.append);
  const changes: ProposalChange[] = [];
  for (const key of Object.keys(append) as AppendField[]) {
    const added = newLinesOnly(a[APPEND_FIELD_COLUMNS[key]], append[key]!);
    if (!added.length) {
      delete append[key];
      continue;
    }
    append[key] = added;
    changes.push({ key: `append.${key}`, label: `Suggest for ${APPEND_FIELDS[key].toLowerCase()}`, before: null, after: added.join('\n'), editable: true });
  }
  if (requestType === 'provenance_update' && !changes.length) {
    return { error: 'Nothing new to suggest: the record already has these lines.' };
  }
  const message = cleanText(args.message, 1000) ?? (requestType === 'ownership_request' ? 'I believe I am the artist of this work.' : 'Suggested from documents I hold.');
  changes.push({ key: 'message', label: 'Message to the holder', before: null, after: message, editable: true });
  const preview: ProposalPreview = {
    title: requestType === 'ownership_request' ? `Claim "${a.title}" as your work` : `Suggest provenance for "${a.title}"`,
    summary: "This work is held by someone else. They'll get your request and decide.",
    artwork: artworkSummary(a),
    changes,
    apply_label: 'Send request',
  };
  return done(
    await saveProposal(userId, { kind: 'provenance_request', artwork_id: a.id, request_type: requestType, append, message }, preview),
  );
}

/* -------------------------------------------------------------------------- */
/*  Page context                                                              */
/* -------------------------------------------------------------------------- */

const ARTWORK_PATH_RE = /^\/artworks\/([0-9a-f-]{36})(?:\/|$)/i;

/** When the user is on an artwork page, tells Taco which work "this" means. */
export async function currentArtworkContext(pathname: string | null, userId: string): Promise<string | null> {
  const id = pathname?.match(ARTWORK_PATH_RE)?.[1];
  if (!id) return null;
  const access = await loadArtworkAccess(id, userId);
  if ('error' in access) return null;
  const a = access.artwork;
  return `The user is viewing the artwork "${a.title}"${a.artist_name ? ` by ${a.artist_name}` : ''} (artwork_id ${a.id}). ${
    access.canEdit ? 'They can edit it.' : 'It is held by someone else; they can only send requests.'
  } "This work" / "this photo" refers to it unless they say otherwise.`;
}
