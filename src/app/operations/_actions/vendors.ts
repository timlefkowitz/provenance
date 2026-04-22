/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { resolveVendorContact } from '~/lib/operations/resolve-counterparty';

const serviceType = z.enum([
  'framer',
  'shipper',
  'conservator',
  'photographer',
  'handler',
  'installer',
  'registrar',
  'other',
]);
const vendStatus = z.enum(['active', 'inactive']);

const createSchema = z.object({
  name: z.string().min(1).max(500),
  service_type: serviceType.optional(),
  contact_name: z.string().max(500).optional().or(z.literal('')),
  contact_email: z.union([z.literal(''), z.string().email()]).optional(),
  phone: z.string().max(100).optional().or(z.literal('')),
  website: z.string().max(2000).optional().or(z.literal('')),
  address: z.string().max(2000).optional().or(z.literal('')),
  notes: z.string().max(20000).optional().or(z.literal('')),
  status: vendStatus.optional(),
});

const updateSchema = createSchema
  .extend({ id: z.string().uuid() })
  .partial()
  .required({ id: true });

export async function createVendor(raw: z.infer<typeof createSchema>) {
  console.log('[Operations/vendors] create');
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
  const d = parsed.data;
  const st = d.service_type ?? 'other';
  const row: Record<string, unknown> = {
    account_id: user.id,
    name: d.name,
    service_type: st,
    contact_name: d.contact_name || null,
    contact_email: d.contact_email || null,
    phone: d.phone || null,
    website: d.website || null,
    address: d.address || null,
    notes: d.notes || null,
    status: (d.status ?? 'active') as 'active' | 'inactive',
  };
  const { data, error } = await client.from('vendors').insert(row).select('id').single();
  if (error) {
    console.error('[Operations/vendors] insert', error);
    return { success: false as const, error: 'Could not create.' };
  }
  const r = await resolveVendorContact({
    email: row.contact_email as string | null,
    recordId: data.id as string,
    ownerAccountId: user.id,
    vendorName: d.name,
    serviceType: st,
    priorEmail: null,
    priorLinkedUserId: null,
  });
  const { error: uErr } = await client
    .from('vendors')
    .update({ contact_user_id: r.userId })
    .eq('id', data.id)
    .eq('account_id', user.id);
  if (uErr) {
    console.error('[Operations/vendors] update contact_user_id', uErr);
  }
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateVendor(raw: z.infer<typeof updateSchema>) {
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
  const { data: prior, error: pErr } = await client
    .from('vendors')
    .select('id, name, service_type, contact_email, contact_user_id')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (pErr) {
    console.error('[Operations/vendors] load prior', pErr);
  }
  if (!prior) {
    return { success: false as const, error: 'Not found.' };
  }
  const p0 = prior as Record<string, string | null | undefined>;
  const patch: Record<string, unknown> = {};
  if (rest.name !== undefined) patch.name = rest.name;
  if (rest.service_type !== undefined) patch.service_type = rest.service_type;
  if (rest.contact_name !== undefined) patch.contact_name = rest.contact_name || null;
  if (rest.contact_email !== undefined) patch.contact_email = rest.contact_email || null;
  if (rest.phone !== undefined) patch.phone = rest.phone || null;
  if (rest.website !== undefined) patch.website = rest.website || null;
  if (rest.address !== undefined) patch.address = rest.address || null;
  if (rest.notes !== undefined) patch.notes = rest.notes || null;
  if (rest.status !== undefined) patch.status = rest.status;

  const { error: uErr } = await client
    .from('vendors')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);
  if (uErr) {
    console.error('[Operations/vendors] update', uErr);
    return { success: false as const, error: 'Could not update.' };
  }

  const newEmail = rest.contact_email !== undefined ? (rest.contact_email || null) : (p0.contact_email ?? null);
  const name = (rest.name as string) ?? (p0.name as string);
  const st = (rest.service_type as string) ?? (p0.service_type as string) ?? 'other';
  const r = await resolveVendorContact({
    email: newEmail,
    recordId: id,
    ownerAccountId: user.id,
    vendorName: name,
    serviceType: st,
    priorEmail: p0.contact_email ?? null,
    priorLinkedUserId: p0.contact_user_id ?? null,
  });
  const { error: p2 } = await client
    .from('vendors')
    .update({ contact_user_id: r.userId })
    .eq('id', id)
    .eq('account_id', user.id);
  if (p2) {
    console.error('[Operations/vendors] update contact_user_id', p2);
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function deleteVendor(id: string) {
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await client.from('vendors').delete().eq('id', id).eq('account_id', user.id);
  if (error) {
    return { success: false as const, error: 'Could not delete.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateVendor(id: string) {
  console.log('[Operations/vendors] duplicate');
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { data: row, error } = await client
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (error || !row) {
    return { success: false as const, error: 'Not found.' };
  }
  const { data: created, error: ins } = await client
    .from('vendors')
    .insert({
      account_id: user.id,
      name: `${row.name} (copy)`,
      service_type: row.service_type,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      phone: row.phone,
      website: row.website,
      address: row.address,
      notes: row.notes,
      status: 'active' as const,
    })
    .select('id')
    .single();
  if (ins) {
    console.error('[Operations/vendors] duplicate insert', ins);
    return { success: false as const, error: 'Could not duplicate.' };
  }
  const st = (row.service_type as string) ?? 'other';
  const r = await resolveVendorContact({
    email: row.contact_email as string | null,
    recordId: created.id as string,
    ownerAccountId: user.id,
    vendorName: `${row.name} (copy)`,
    serviceType: st,
    priorEmail: null,
    priorLinkedUserId: null,
  });
  await client
    .from('vendors')
    .update({ contact_user_id: r.userId })
    .eq('id', created.id)
    .eq('account_id', user.id);
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}
