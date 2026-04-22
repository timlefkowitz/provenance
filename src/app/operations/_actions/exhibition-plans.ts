/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { insertProvenanceEventForOperations } from '~/lib/operations/operations-provenance';
import {
  notifyCounterpartyStatusActive,
  resolveCounterparty,
} from '~/lib/operations/resolve-counterparty';

const planStatus = z.enum(['planning', 'confirmed', 'installed', 'closed', 'cancelled']);

const createSchema = z.object({
  artwork_id: z.string().uuid(),
  exhibition_id: z.string().uuid().nullable().optional(),
  exhibition_title: z.string().max(500).optional().or(z.literal('')),
  venue_name: z.string().max(500).optional().or(z.literal('')),
  venue_location: z.string().max(2000).optional().or(z.literal('')),
  install_date: z.string().optional().or(z.literal('')),
  deinstall_date: z.string().optional().or(z.literal('')),
  object_label: z.string().max(500).optional().or(z.literal('')),
  lender_name: z.string().max(500).optional().or(z.literal('')),
  lender_email: z.union([z.literal(''), z.string().email()]).optional(),
  curator_name: z.string().max(500).optional().or(z.literal('')),
  curator_email: z.union([z.literal(''), z.string().email()]).optional(),
  notes: z.string().max(20000).optional().or(z.literal('')),
  document_storage_path: z.string().max(2000).optional().nullable(),
  status: planStatus.optional(),
});

const updateSchema = createSchema
  .extend({ id: z.string().uuid() })
  .partial()
  .required({ id: true });

async function assertArtworkOwned(client: any, userId: string, artworkId: string) {
  const { data, error } = await client
    .from('artworks')
    .select('id')
    .eq('id', artworkId)
    .eq('account_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Operations/exhibition-plans] assertArtworkOwned', error);
  }
  return Boolean(data);
}

async function assertExhibitionInAccount(client: any, userId: string, exhibitionId: string) {
  const { data, error } = await client
    .from('exhibitions')
    .select('id')
    .eq('id', exhibitionId)
    .eq('gallery_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Operations/exhibition-plans] assertExhibitionInAccount', error);
  }
  return Boolean(data);
}

type PriorE = {
  lender_email: string | null;
  lender_user_id: string | null;
  curator_email: string | null;
  curator_user_id: string | null;
};

async function applyExhibitionPlanCounterparties(
  client: any,
  ownerId: string,
  rowId: string,
  artworkId: string,
  lenderEmail: string | null,
  curatorEmail: string | null,
  prior: PriorE | null,
) {
  const p: PriorE =
    prior ?? {
      lender_email: null,
      lender_user_id: null,
      curator_email: null,
      curator_user_id: null,
    };
  const { data: art } = await client.from('artworks').select('title').eq('id', artworkId).maybeSingle();
  const title = (art as { title?: string } | null)?.title?.trim() || 'Artwork';

  const a = await resolveCounterparty({
    email: lenderEmail,
    role: 'lender',
    recordKind: 'exhibition_plan',
    recordId: rowId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.lender_email,
    priorLinkedUserId: p.lender_user_id,
  });
  const b = await resolveCounterparty({
    email: curatorEmail,
    role: 'curator',
    recordKind: 'exhibition_plan',
    recordId: rowId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.curator_email,
    priorLinkedUserId: p.curator_user_id,
  });
  const { error } = await client
    .from('exhibition_object_plans')
    .update({ lender_user_id: a.userId, curator_user_id: b.userId })
    .eq('id', rowId)
    .eq('account_id', ownerId);
  if (error) {
    console.error('[Operations/exhibition-plans] update user ids', error);
  }
  return { artworkTitle: title, lenderUserId: a.userId, curatorUserId: b.userId };
}

async function fireConfirmedEvents(
  client: any,
  userId: string,
  planId: string,
  artworkId: string,
  artworkTitle: string,
  lenderUserId: string | null,
  exhibitionTitle: string | null,
) {
  const { data: cRow } = await client
    .from('exhibition_object_plans')
    .select('lender_user_id')
    .eq('id', planId)
    .eq('account_id', userId)
    .maybeSingle();
  const lid = (cRow as { lender_user_id?: string } | null)?.lender_user_id ?? lenderUserId;
  await notifyCounterpartyStatusActive({
    kind: 'exhibition_plan',
    counterpartyUserId: lid ?? null,
    ownerAccountId: userId,
    recordId: planId,
    artworkId,
    artworkTitle,
    milestone: 'confirmed',
  });
  await insertProvenanceEventForOperations({
    artworkId,
    eventType: 'exhibition_object_confirmed',
    actorAccountId: userId,
    metadata: {
      exhibition_object_plan_id: planId,
      exhibition_title: exhibitionTitle,
    },
  });
}

export async function createExhibitionPlan(raw: z.infer<typeof createSchema>) {
  console.log('[Operations/exhibition-plans] create');
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid data.' };
  }
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  if (!(await assertArtworkOwned(client, user.id, parsed.data.artwork_id))) {
    return { success: false as const, error: 'Artwork not in your collection.' };
  }
  const d = parsed.data;
  if (d.exhibition_id) {
    if (!(await assertExhibitionInAccount(client, user.id, d.exhibition_id))) {
      return { success: false as const, error: 'Exhibition not found in your account.' };
    }
  }
  const row: Record<string, unknown> = {
    account_id: user.id,
    artwork_id: d.artwork_id,
    exhibition_id: d.exhibition_id ?? null,
    exhibition_title: d.exhibition_title || null,
    venue_name: d.venue_name || null,
    venue_location: d.venue_location || null,
    install_date: d.install_date || null,
    deinstall_date: d.deinstall_date || null,
    object_label: d.object_label || null,
    lender_name: d.lender_name || null,
    lender_email: d.lender_email || null,
    curator_name: d.curator_name || null,
    curator_email: d.curator_email || null,
    notes: d.notes || null,
    document_storage_path: d.document_storage_path ?? null,
    status: (d.status ?? 'planning') as 'planning' | 'confirmed' | 'installed' | 'closed' | 'cancelled',
  };
  const { data, error } = await client
    .from('exhibition_object_plans')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    console.error('[Operations/exhibition-plans] insert', error);
    return { success: false as const, error: 'Could not create.' };
  }
  const ap = await applyExhibitionPlanCounterparties(
    client,
    user.id,
    data.id as string,
    d.artwork_id,
    row.lender_email as string | null,
    row.curator_email as string | null,
    null,
  );
  if (row.status === 'confirmed') {
    await fireConfirmedEvents(
      client,
      user.id,
      data.id as string,
      d.artwork_id,
      ap.artworkTitle,
      ap.lenderUserId,
      (row.exhibition_title as string) ?? null,
    );
  }
  if (row.status === 'installed') {
    await insertProvenanceEventForOperations({
      artworkId: d.artwork_id,
      eventType: 'exhibition_object_installed',
      actorAccountId: user.id,
      metadata: {
        exhibition_object_plan_id: data.id,
        exhibition_title: row.exhibition_title,
      },
    });
  }
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateExhibitionPlan(raw: z.infer<typeof updateSchema>) {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid update.' };
  }
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { id, ...rest } = parsed.data;
  if (rest.exhibition_id !== undefined && rest.exhibition_id) {
    if (!(await assertExhibitionInAccount(client, user.id, rest.exhibition_id))) {
      return { success: false as const, error: 'Exhibition not found in your account.' };
    }
  }
  if (rest.artwork_id) {
    if (!(await assertArtworkOwned(client, user.id, rest.artwork_id))) {
      return { success: false as const, error: 'Artwork not in your collection.' };
    }
  }
  const { data: prior, error: pErr } = await client
    .from('exhibition_object_plans')
    .select(
      'id, status, artwork_id, exhibition_title, lender_name, lender_email, lender_user_id, curator_name, curator_email, curator_user_id',
    )
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (pErr) {
    console.error('[Operations/exhibition-plans] load prior', pErr);
  }
  if (!prior) {
    return { success: false as const, error: 'Not found.' };
  }
  const p0 = prior as Record<string, string | null | undefined>;
  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.exhibition_id !== undefined) {
    patch.exhibition_id = rest.exhibition_id;
  }
  if (rest.exhibition_title !== undefined) patch.exhibition_title = rest.exhibition_title || null;
  if (rest.venue_name !== undefined) patch.venue_name = rest.venue_name || null;
  if (rest.venue_location !== undefined) patch.venue_location = rest.venue_location || null;
  if (rest.install_date !== undefined) patch.install_date = rest.install_date || null;
  if (rest.deinstall_date !== undefined) patch.deinstall_date = rest.deinstall_date || null;
  if (rest.object_label !== undefined) patch.object_label = rest.object_label || null;
  if (rest.lender_name !== undefined) patch.lender_name = rest.lender_name || null;
  if (rest.lender_email !== undefined) patch.lender_email = rest.lender_email || null;
  if (rest.curator_name !== undefined) patch.curator_name = rest.curator_name || null;
  if (rest.curator_email !== undefined) patch.curator_email = rest.curator_email || null;
  if (rest.notes !== undefined) patch.notes = rest.notes || null;
  if (rest.document_storage_path !== undefined) {
    patch.document_storage_path = rest.document_storage_path ?? null;
  }
  if (rest.status !== undefined) patch.status = rest.status;

  const { error: uErr } = await client
    .from('exhibition_object_plans')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);
  if (uErr) {
    console.error('[Operations/exhibition-plans] update', uErr);
    return { success: false as const, error: 'Could not update.' };
  }

  const newLend =
    rest.lender_email !== undefined ? (rest.lender_email || null) : (p0.lender_email ?? null);
  const newCur =
    rest.curator_email !== undefined ? (rest.curator_email || null) : (p0.curator_email ?? null);
  const artId = (rest.artwork_id as string) ?? (p0.artwork_id as string);
  const newStatus = rest.status !== undefined ? rest.status : p0.status;
  const oldStatus = p0.status;

  if (artId) {
    const info = await applyExhibitionPlanCounterparties(
      client,
      user.id,
      id,
      artId,
      newLend,
      newCur,
      {
        lender_email: p0.lender_email ?? null,
        lender_user_id: p0.lender_user_id ?? null,
        curator_email: p0.curator_email ?? null,
        curator_user_id: p0.curator_user_id ?? null,
      },
    );
    if (newStatus === 'confirmed' && oldStatus && oldStatus !== 'confirmed') {
      const et =
        rest.exhibition_title !== undefined
          ? rest.exhibition_title || null
          : (p0.exhibition_title ?? null);
      await fireConfirmedEvents(
        client,
        user.id,
        id,
        artId,
        info.artworkTitle,
        info.lenderUserId,
        et,
      );
    }
    if (newStatus === 'installed' && oldStatus && oldStatus !== 'installed') {
      await insertProvenanceEventForOperations({
        artworkId: artId,
        eventType: 'exhibition_object_installed',
        actorAccountId: user.id,
        metadata: {
          exhibition_object_plan_id: id,
          exhibition_title: rest.exhibition_title ?? p0.exhibition_title,
        },
      });
    }
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function deleteExhibitionPlan(id: string) {
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await client
    .from('exhibition_object_plans')
    .delete()
    .eq('id', id)
    .eq('account_id', user.id);
  if (error) {
    return { success: false as const, error: 'Could not delete.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateExhibitionPlan(id: string) {
  console.log('[Operations/exhibition-plans] duplicate');
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { data: row, error } = await client
    .from('exhibition_object_plans')
    .select('*')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (error || !row) {
    return { success: false as const, error: 'Not found.' };
  }
  const { data: created, error: ins } = await client
    .from('exhibition_object_plans')
    .insert({
      account_id: user.id,
      artwork_id: row.artwork_id,
      exhibition_id: row.exhibition_id,
      exhibition_title: row.exhibition_title,
      venue_name: row.venue_name,
      venue_location: row.venue_location,
      install_date: null,
      deinstall_date: null,
      object_label: null,
      lender_name: row.lender_name,
      lender_email: row.lender_email,
      curator_name: row.curator_name,
      curator_email: row.curator_email,
      status: 'planning' as const,
      notes: row.notes,
      document_storage_path: null,
      alert_sent_at: null,
    })
    .select('id')
    .single();
  if (ins) {
    console.error('[Operations/exhibition-plans] duplicate insert', ins);
    return { success: false as const, error: 'Could not duplicate.' };
  }
  await applyExhibitionPlanCounterparties(
    client,
    user.id,
    created.id as string,
    row.artwork_id as string,
    row.lender_email as string | null,
    row.curator_email as string | null,
    null,
  );
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}
