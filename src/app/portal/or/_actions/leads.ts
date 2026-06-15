'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { resolveArtistUserId } from '~/lib/crm/owner';
import {
  intelHasContent,
  normalizeIntel,
} from './crm-intel';
import { type ArtistLead, type CrmLeadIntel, type LeadStage } from './leads-constants';

const CRM_PATHS = ['/portal/or', '/mailing-list'] as const;

function revalidateCrmPaths() {
  for (const path of CRM_PATHS) {
    revalidatePath(path);
  }
}

const SELECT_FIELDS = `
  id,
  artist_user_id,
  contact_name,
  contact_email,
  contact_phone,
  notes,
  is_lead,
  stage,
  artwork_id,
  estimated_value,
  follow_up_date,
  source,
  intel,
  created_at,
  updated_at,
  artwork:artworks(id, title, image_url)
`;

function normalizeLeads(rows: any[]): ArtistLead[] {
  return rows.map((row) => ({
    ...row,
    is_lead: row.is_lead !== false,
    artwork: Array.isArray(row.artwork) ? row.artwork[0] ?? null : row.artwork ?? null,
    intel: normalizeIntel(row.intel),
  }));
}

export async function getLeadsForArtist(): Promise<ArtistLead[]> {
  console.log('[Leads] getLeadsForArtist started');
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] getLeadsForArtist: no user');
    return [];
  }

  const artistUserId = await resolveArtistUserId(client, user.id);

  const { data, error } = await (client as any)
    .from('artist_leads')
    .select(SELECT_FIELDS)
    .eq('artist_user_id', artistUserId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Leads] getLeadsForArtist failed', error);
    return [];
  }

  const leads = normalizeLeads(data || []);
  console.log('[Leads] getLeadsForArtist success', leads.length, 'leads');
  return leads as ArtistLead[];
}

export async function createLead(input: {
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  artwork_id?: string | null;
  estimated_value?: number | null;
  follow_up_date?: string | null;
  source?: string | null;
  intel?: CrmLeadIntel | null;
}) {
  console.log('[Leads] createLead started', input);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] createLead: no user');
    return { success: false, error: 'You must be logged in to add leads.' };
  }

  const artistUserId = await resolveArtistUserId(client, user.id);

  const intel =
    input.intel && intelHasContent(input.intel) ? input.intel : ({} as Record<string, unknown>);

  const { error } = await (client as any).from('artist_leads').insert({
    artist_user_id: artistUserId,
    contact_name:    input.contact_name    || null,
    contact_email:   input.contact_email   || null,
    contact_phone:   input.contact_phone   || null,
    notes:           input.notes           || null,
    artwork_id:      input.artwork_id      || null,
    estimated_value: input.estimated_value ?? null,
    follow_up_date:  input.follow_up_date  || null,
    source:          input.source          || null,
    intel,
    stage: 'interested',
    is_lead: true,
  });

  if (error) {
    console.error('[Leads] createLead failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] createLead success');
  revalidateCrmPaths();
  return { success: true };
}

export async function createContact(input: {
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
}) {
  console.log('[Leads] createContact started', input);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] createContact: no user');
    return { success: false, error: 'You must be logged in to add contacts.' };
  }

  const name = input.contact_name?.trim() || null;
  const email = input.contact_email?.trim().toLowerCase() || null;
  const phone = input.contact_phone?.trim() || null;

  if (!name && !email) {
    return { success: false, error: 'Enter a name or email address.' };
  }

  const artistUserId = await resolveArtistUserId(client, user.id);

  const { error } = await (client as any).from('artist_leads').insert({
    artist_user_id: artistUserId,
    contact_name: name,
    contact_email: email,
    contact_phone: phone,
    notes: input.notes?.trim() || null,
    source: 'mailing_list',
    stage: 'interested',
    is_lead: false,
    intel: {},
  });

  if (error) {
    console.error('[Leads] createContact failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] createContact success');
  revalidateCrmPaths();
  return { success: true };
}

export async function promoteContactToLead(leadId: string) {
  console.log('[Leads] promoteContactToLead', leadId);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] promoteContactToLead: no user');
    return { success: false, error: 'You must be logged in.' };
  }

  const artistUserId = await resolveArtistUserId(client, user.id);

  const { error } = await (client as any)
    .from('artist_leads')
    .update({ is_lead: true, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('artist_user_id', artistUserId);

  if (error) {
    console.error('[Leads] promoteContactToLead failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] promoteContactToLead success');
  revalidateCrmPaths();
  return { success: true };
}

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  console.log('[Leads] updateLeadStage', leadId, stage);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] updateLeadStage: no user');
    return { success: false, error: 'You must be logged in.' };
  }

  const artistUserId = await resolveArtistUserId(client, user.id);

  const { error } = await (client as any)
    .from('artist_leads')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('artist_user_id', artistUserId);

  if (error) {
    console.error('[Leads] updateLeadStage failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] updateLeadStage success');
  revalidateCrmPaths();
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
    estimated_value?: number | null;
    follow_up_date?: string | null;
    source?: string | null;
    intel?: CrmLeadIntel | null;
  },
) {
  console.log('[Leads] updateLead', leadId, input);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] updateLead: no user');
    return { success: false, error: 'You must be logged in.' };
  }

  const artistUserId = await resolveArtistUserId(client, user.id);

  const intelPayload =
    input.intel === undefined
      ? undefined
      : input.intel && intelHasContent(input.intel)
        ? input.intel
        : ({} as Record<string, unknown>);

  const { error } = await (client as any)
    .from('artist_leads')
    .update({
      contact_name:    input.contact_name    ?? undefined,
      contact_email:   input.contact_email   ?? undefined,
      contact_phone:   input.contact_phone   ?? undefined,
      notes:           input.notes           ?? undefined,
      artwork_id:      input.artwork_id      ?? undefined,
      estimated_value: input.estimated_value ?? undefined,
      follow_up_date:  input.follow_up_date  ?? undefined,
      source:          input.source          ?? undefined,
      ...(intelPayload !== undefined ? { intel: intelPayload } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('artist_user_id', artistUserId);

  if (error) {
    console.error('[Leads] updateLead failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] updateLead success');
  revalidateCrmPaths();
  return { success: true };
}

export async function deleteLead(leadId: string) {
  console.log('[Leads] deleteLead', leadId);
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Leads] deleteLead: no user');
    return { success: false, error: 'You must be logged in.' };
  }

  const artistUserId = await resolveArtistUserId(client, user.id);

  const { error } = await (client as any)
    .from('artist_leads')
    .delete()
    .eq('id', leadId)
    .eq('artist_user_id', artistUserId);

  if (error) {
    console.error('[Leads] deleteLead failed', error);
    return { success: false, error: error.message };
  }

  console.log('[Leads] deleteLead success');
  revalidateCrmPaths();
  return { success: true };
}
