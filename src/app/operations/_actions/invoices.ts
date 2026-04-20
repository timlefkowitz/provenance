/* eslint-disable @typescript-eslint/no-explicit-any -- Operations tables not in generated DB types */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const invoiceStatus = z.enum(['draft', 'sent', 'partial', 'paid', 'overdue']);

const lineItemSchema = z.object({
  description: z.string().max(2000),
  quantity: z.number().positive().max(1_000_000),
  unit_amount_cents: z.number().int().min(0).max(100_000_000),
});

const createInvoiceSchema = z.object({
  client_name: z.string().min(1).max(500),
  client_email: z.union([z.literal(''), z.string().email()]).optional(),
  currency: z.string().min(3).max(8).default('USD'),
  due_date: z.string().optional().or(z.literal('')),
  tax_cents: z.number().int().min(0).max(100_000_000).default(0),
  notes: z.string().max(10000).optional(),
  artwork_id: z.string().uuid().optional().nullable(),
  line_items: z.array(lineItemSchema).min(1).max(50),
});

const updateInvoiceSchema = z.object({
  id: z.string().uuid(),
  client_name: z.string().min(1).max(500).optional(),
  client_email: z.union([z.literal(''), z.string().email()]).optional(),
  currency: z.string().min(3).max(8).optional(),
  due_date: z.string().optional().or(z.literal('')).optional(),
  tax_cents: z.number().int().min(0).optional(),
  notes: z.string().max(10000).optional().nullable(),
  artwork_id: z.string().uuid().nullable().optional(),
  status: invoiceStatus.optional(),
  line_items: z.array(lineItemSchema.extend({ id: z.string().uuid().optional() })).min(1).max(50).optional(),
});

function makeInvoiceNumber() {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

async function assertArtworkOwnedOptional(
  client: unknown,
  userId: string,
  artworkId: string | null | undefined,
): Promise<boolean> {
  if (!artworkId) return true;
  const { data, error } = await (client as any)
    .from('artworks')
    .select('id')
    .eq('id', artworkId)
    .eq('account_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Operations/invoices] assertArtworkOwnedOptional failed', error);
    return false;
  }
  return Boolean(data);
}

export async function createInvoice(raw: z.infer<typeof createInvoiceSchema>) {
  console.log('[Operations/invoices] createInvoice started');
  const parsed = createInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/invoices] createInvoice validation', parsed.error.flatten());
    return { success: false as const, error: 'Invalid invoice data.' };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }

  const artworkOk = await assertArtworkOwnedOptional(
    client,
    user.id,
    parsed.data.artwork_id ?? null,
  );
  if (!artworkOk) {
    return { success: false as const, error: 'Linked artwork not found in your collection.' };
  }

  const invoice_number = makeInvoiceNumber();
  const { data: inv, error: invErr } = await (client as any)
    .from('invoices')
    .insert({
      account_id: user.id,
      invoice_number,
      client_name: parsed.data.client_name,
      client_email: parsed.data.client_email || null,
      currency: parsed.data.currency,
      due_date: parsed.data.due_date || null,
      tax_cents: parsed.data.tax_cents,
      notes: parsed.data.notes ?? null,
      artwork_id: parsed.data.artwork_id ?? null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (invErr || !inv) {
    console.error('[Operations/invoices] createInvoice insert failed', invErr);
    return { success: false as const, error: 'Could not create invoice.' };
  }

  const invoiceId = inv.id as string;
  const lineRows = parsed.data.line_items.map((l, i) => ({
    invoice_id: invoiceId,
    description: l.description,
    quantity: l.quantity,
    unit_amount_cents: l.unit_amount_cents,
    sort_order: i,
  }));

  const { error: lineErr } = await (client as any).from('invoice_line_items').insert(lineRows);

  if (lineErr) {
    console.error('[Operations/invoices] createInvoice line items failed', lineErr);
    await (client as any).from('invoices').delete().eq('id', invoiceId).eq('account_id', user.id);
    return { success: false as const, error: 'Could not save line items.' };
  }

  console.log('[Operations/invoices] createInvoice success', invoiceId);
  revalidatePath('/operations');
  return { success: true as const, id: invoiceId };
}

export async function updateInvoice(raw: z.infer<typeof updateInvoiceSchema>) {
  console.log('[Operations/invoices] updateInvoice started', raw.id);
  const parsed = updateInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/invoices] updateInvoice validation', parsed.error.flatten());
    return { success: false as const, error: 'Invalid update.' };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }

  const { id, line_items, ...rest } = parsed.data;

  if (rest.artwork_id !== undefined && rest.artwork_id !== null) {
    const ok = await assertArtworkOwnedOptional(client, user.id, rest.artwork_id);
    if (!ok) {
      return { success: false as const, error: 'Linked artwork not found in your collection.' };
    }
  }

  const patch: Record<string, unknown> = {};
  if (rest.client_name !== undefined) patch.client_name = rest.client_name;
  if (rest.client_email !== undefined) patch.client_email = rest.client_email || null;
  if (rest.currency !== undefined) patch.currency = rest.currency;
  if (rest.due_date !== undefined) patch.due_date = rest.due_date || null;
  if (rest.tax_cents !== undefined) patch.tax_cents = rest.tax_cents;
  if (rest.notes !== undefined) patch.notes = rest.notes;
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.status !== undefined) patch.status = rest.status;

  if (Object.keys(patch).length > 0) {
    const { error } = await (client as any)
      .from('invoices')
      .update(patch)
      .eq('id', id)
      .eq('account_id', user.id);
    if (error) {
      console.error('[Operations/invoices] updateInvoice header failed', error);
      return { success: false as const, error: 'Could not update invoice.' };
    }
  }

  if (line_items) {
    const { error: delErr } = await (client as any)
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', id);
    if (delErr) {
      console.error('[Operations/invoices] updateInvoice delete lines failed', delErr);
      return { success: false as const, error: 'Could not replace line items.' };
    }
    const lineRows = line_items.map((l, i) => ({
      invoice_id: id,
      description: l.description,
      quantity: l.quantity,
      unit_amount_cents: l.unit_amount_cents,
      sort_order: i,
    }));
    const { error: insErr } = await (client as any).from('invoice_line_items').insert(lineRows);
    if (insErr) {
      console.error('[Operations/invoices] updateInvoice insert lines failed', insErr);
      return { success: false as const, error: 'Could not save line items.' };
    }
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateInvoice(id: string) {
  console.log('[Operations/invoices] duplicateInvoice started', id);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }

  const { data: inv, error } = await (client as any)
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();

  if (error || !inv) {
    console.error('[Operations/invoices] duplicateInvoice load failed', error);
    return { success: false as const, error: 'Invoice not found.' };
  }

  const { data: lines } = await (client as any)
    .from('invoice_line_items')
    .select('description, quantity, unit_amount_cents, sort_order')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });

  const invoice_number = makeInvoiceNumber();
  const { data: created, error: insErr } = await (client as any)
    .from('invoices')
    .insert({
      account_id: user.id,
      invoice_number,
      client_name: inv.client_name,
      client_email: inv.client_email,
      currency: inv.currency,
      due_date: inv.due_date,
      tax_cents: inv.tax_cents,
      notes: inv.notes,
      artwork_id: inv.artwork_id,
      status: 'draft',
      sent_at: null,
      paid_at: null,
    })
    .select('id')
    .single();

  if (insErr || !created) {
    console.error('[Operations/invoices] duplicateInvoice insert failed', insErr);
    return { success: false as const, error: 'Could not duplicate invoice.' };
  }

  const newId = created.id as string;
  if (lines?.length) {
    const lineRows = lines.map((l: any, i: number) => ({
      invoice_id: newId,
      description: l.description,
      quantity: l.quantity,
      unit_amount_cents: l.unit_amount_cents,
      sort_order: i,
    }));
    const { error: lineErr } = await (client as any).from('invoice_line_items').insert(lineRows);
    if (lineErr) {
      console.error('[Operations/invoices] duplicateInvoice lines failed', lineErr);
      await (client as any).from('invoices').delete().eq('id', newId).eq('account_id', user.id);
      return { success: false as const, error: 'Could not copy line items.' };
    }
  }

  revalidatePath('/operations');
  return { success: true as const, id: newId };
}

export async function markInvoiceSent(id: string) {
  console.log('[Operations/invoices] markInvoiceSent', id);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }

  const { error } = await (client as any)
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', user.id);

  if (error) {
    console.error('[Operations/invoices] markInvoiceSent failed', error);
    return { success: false as const, error: 'Could not mark sent.' };
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function markInvoicePaid(id: string) {
  console.log('[Operations/invoices] markInvoicePaid', id);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }

  const { error } = await (client as any)
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', user.id);

  if (error) {
    console.error('[Operations/invoices] markInvoicePaid failed', error);
    return { success: false as const, error: 'Could not mark paid.' };
  }

  revalidatePath('/operations');
  return { success: true as const };
}
