'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';

export type AdminContactRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  notes: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

async function requireAdminUserId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const ok = await isAdmin(user.id);
  return ok ? user.id : null;
}

export async function listAdminContacts(): Promise<
  { ok: true; contacts: AdminContactRow[] } | { ok: false; error: string }
> {
  console.log('[AdminContacts] listAdminContacts started');
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('admin_contacts')
    .select(
      'id, display_name, email, phone, company, website, notes, source, created_by, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[AdminContacts] list failed', error);
    return { ok: false, error: 'Failed to load contacts.' };
  }

  console.log('[AdminContacts] list ok', { count: data?.length ?? 0 });
  return { ok: true, contacts: (data ?? []) as AdminContactRow[] };
}

export async function createAdminContact(input: {
  displayName: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  notes?: string;
  source?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[AdminContacts] createAdminContact started');
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const display_name = input.displayName.trim();
  if (!display_name) {
    return { ok: false, error: 'Name is required.' };
  }

  const admin = getSupabaseServerAdminClient();
  const row = {
    display_name,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    company: input.company?.trim() || null,
    website: input.website?.trim() || null,
    notes: input.notes?.trim() || null,
    source: (input.source?.trim() || 'manual').slice(0, 128),
    created_by: adminId,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('admin_contacts').insert(row);

  if (error) {
    console.error('[AdminContacts] create failed', error);
    return { ok: false, error: 'Failed to save contact.' };
  }

  console.log('[AdminContacts] createAdminContact saved');
  revalidatePath('/admin/contacts');
  return { ok: true };
}

export async function deleteAdminContact(
  contactId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[AdminContacts] deleteAdminContact started');
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('admin_contacts').delete().eq('id', contactId);

  if (error) {
    console.error('[AdminContacts] delete failed', error);
    return { ok: false, error: 'Failed to delete contact.' };
  }

  console.log('[AdminContacts] deleteAdminContact done', { contactId });
  revalidatePath('/admin/contacts');
  return { ok: true };
}

export async function importLeadRowsToContacts(
  rows: { title: string; email?: string; phone?: string; url?: string; address?: string }[],
): Promise<
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string }
> {
  console.log('[AdminContacts] importLeadRowsToContacts started', { rows: rows.length });
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = getSupabaseServerAdminClient();
  let inserted = 0;
  let skipped = 0;

  for (const r of rows.slice(0, 100)) {
    const display_name = (r.title || '').trim() || 'Lead';
    const email = r.email?.trim() || null;
    const phone = r.phone?.trim() || null;
    const website = r.url?.trim() || null;
    const notes = r.address?.trim() ? `Address: ${r.address.trim()}` : null;

    if (!email && !phone && !website && !notes) {
      skipped++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from('admin_contacts').insert({
      display_name,
      email,
      phone,
      website,
      company: null,
      notes,
      source: 'apify_lead',
      created_by: adminId,
    });

    if (error) {
      console.error('[AdminContacts] import row failed', error);
      skipped++;
      continue;
    }
    inserted++;
  }

  console.log('[AdminContacts] importLeadRowsToContacts done', { inserted, skipped });
  revalidatePath('/admin/contacts');
  return { ok: true, inserted, skipped };
}
