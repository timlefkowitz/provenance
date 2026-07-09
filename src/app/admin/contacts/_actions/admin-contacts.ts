'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { requireAdminUserId } from '~/lib/admin';

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
  const { error } = await admin.from('admin_contacts').insert(row);

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
  const { error } = await admin.from('admin_contacts').delete().eq('id', contactId);

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
    const { error } = await admin.from('admin_contacts').insert({
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

function strVal(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

/** Map one object from pasted JSON (e.g. attorney / directory exports) into admin_contacts columns. */
function mapExternalDirectoryRow(raw: Record<string, unknown>): {
  display_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  notes: string | null;
} | null {
  const fullName = strVal(raw.full_name);
  const fn = strVal(raw.first_name);
  const ln = strVal(raw.last_name);
  const display_name =
    fullName ||
    [fn, ln].filter(Boolean).join(' ').trim() ||
    strVal(raw.name) ||
    strVal(raw.title) ||
    strVal(raw.company) ||
    'Contact';

  const email = strVal(raw.email)?.toLowerCase() ?? null;
  const phone = strVal(raw.phone) ?? null;
  const company = strVal(raw.office) ?? strVal(raw.company) ?? null;
  const website = strVal(raw.website) ?? strVal(raw.url) ?? null;

  const a1 = strVal(raw.address1);
  const a2 = strVal(raw.address2);
  const city = strVal(raw.city);
  const state = strVal(raw.state);
  const zip = strVal(raw.zipcode);
  const extId = strVal(raw.id);

  const noteParts: string[] = [];
  if (extId) noteParts.push(`External id: ${extId}`);
  if (a1) noteParts.push(a1);
  if (a2) noteParts.push(a2);
  const cityLine = [city, state, zip].filter(Boolean).join(', ');
  if (cityLine) noteParts.push(cityLine);
  const county = strVal(raw.county);
  if (county) noteParts.push(`County: ${county}`);
  const area = strVal(raw.area);
  if (area) noteParts.push(`Area: ${area}`);
  const pa = strVal(raw.practice_areas);
  if (pa) noteParts.push(`Practice: ${pa}`);
  const school = strVal(raw.school_name);
  if (school) noteParts.push(`School: ${school}`);

  const notes = noteParts.length ? noteParts.join(' · ') : null;

  const hasReach = !!(email || phone || website);
  const hasAddress = !!a1;
  if (!hasReach && !hasAddress) {
    return null;
  }

  return { display_name, email, phone, company, website, notes };
}

/**
 * Paste a JSON array of contact objects (flexible keys: full_name, email, phone, office, address1, …).
 */
export async function importContactsFromJsonText(
  jsonText: string,
  sourceLabel?: string,
): Promise<
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string }
> {
  console.log('[AdminContacts] importContactsFromJsonText started');
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    console.error('[AdminContacts] JSON parse failed');
    return { ok: false, error: 'Invalid JSON. Paste a single array [...].' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'JSON must be an array of objects, e.g. [ {...}, {...} ].' };
  }

  const source = (sourceLabel?.trim() || 'json_import').slice(0, 128);
  const admin = getSupabaseServerAdminClient();
  let inserted = 0;
  let skipped = 0;

  const maxRows = 2000;
  for (const item of parsed.slice(0, maxRows)) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      skipped++;
      continue;
    }
    const mapped = mapExternalDirectoryRow(item as Record<string, unknown>);
    if (!mapped) {
      skipped++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin.from('admin_contacts').insert({
      display_name: mapped.display_name,
      email: mapped.email,
      phone: mapped.phone,
      company: mapped.company,
      website: mapped.website,
      notes: mapped.notes,
      source,
      created_by: adminId,
    });

    if (error) {
      console.error('[AdminContacts] import JSON row failed', error);
      skipped++;
      continue;
    }
    inserted++;
  }

  console.log('[AdminContacts] importContactsFromJsonText done', { inserted, skipped, source });
  revalidatePath('/admin/contacts');
  return { ok: true, inserted, skipped };
}
