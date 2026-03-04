'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { type ArtistLead, type LeadStage } from './leads-constants';

export async function getLeadsForArtist(): Promise<ArtistLead[]> {
  console.log('[Leads] getLeadsForArtist started');
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] getLeadsForArtist: no user');
    return [];
  }

  const { data, error } = await (client as any)
    .from('artist_leads')
    .select(
      `
      id,
      artist_user_id,
      contact_name,
      contact_email,
      contact_phone,
      notes,
      stage,
      artwork_id,
      created_at,
      updated_at,
      artwork:artworks(id, title, image_url)
    `
    )
    .eq('artist_user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Leads] getLeadsForArtist failed', error);
    return [];
  }

  const leads = (data || []).map((row: any) => ({
    ...row,
    artwork: Array.isArray(row.artwork) ? row.artwork[0] ?? null : row.artwork ?? null,
  }));
  console.log('[Leads] getLeadsForArtist success', leads.length, 'leads');
  return leads as ArtistLead[];
}

export async function createLead(input: {
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  artwork_id?: string | null;
}) {
  console.log('[Leads] createLead started', input);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] createLead: no user');
    return { success: false, error: 'You must be logged in to add leads.' };
  }

  const { error } = await (client as any).from('artist_leads').insert({
    artist_user_id: user.id,
    contact_name: input.contact_name || null,
    contact_email: input.contact_email || null,
    contact_phone: input.contact_phone || null,
    notes: input.notes || null,
    artwork_id: input.artwork_id || null,
    stage: 'interested',
  });

  if (error) {
    console.error('[Leads] createLead failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] createLead success');
  revalidatePath('/portal/leads');
  return { success: true };
}

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  console.log('[Leads] updateLeadStage', leadId, stage);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] updateLeadStage: no user');
    return { success: false, error: 'You must be logged in.' };
  }

  const { error } = await (client as any)
    .from('artist_leads')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('artist_user_id', user.id);

  if (error) {
    console.error('[Leads] updateLeadStage failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] updateLeadStage success');
  revalidatePath('/portal/leads');
  return { success: true };
}

export async function updateLead(
  leadId: string,
  input: {
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    notes?: string | null;
    artwork_id?: string | null;
  }
) {
  console.log('[Leads] updateLead', leadId, input);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] updateLead: no user');
    return { success: false, error: 'You must be logged in.' };
  }

  const { error } = await (client as any)
    .from('artist_leads')
    .update({
      contact_name: input.contact_name ?? undefined,
      contact_email: input.contact_email ?? undefined,
      contact_phone: input.contact_phone ?? undefined,
      notes: input.notes ?? undefined,
      artwork_id: input.artwork_id ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('artist_user_id', user.id);

  if (error) {
    console.error('[Leads] updateLead failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] updateLead success');
  revalidatePath('/portal/leads');
  return { success: true };
}

export async function deleteLead(leadId: string) {
  console.log('[Leads] deleteLead', leadId);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] deleteLead: no user');
    return { success: false, error: 'You must be logged in.' };
  }

  const { error } = await (client as any)
    .from('artist_leads')
    .delete()
    .eq('id', leadId)
    .eq('artist_user_id', user.id);

  if (error) {
    console.error('[Leads] deleteLead failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] deleteLead success');
  revalidatePath('/portal/leads');
  return { success: true };
}
