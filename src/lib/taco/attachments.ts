import type { SupabaseClient } from '@supabase/supabase-js';

import { asUntyped } from '~/lib/supabase-untyped';

/** A file the user dropped into Taco, stored server-side (see /api/taco/attachments). */
export type TacoAttachment = {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  kind: 'image' | 'document';
  mime: string;
  name: string;
  extracted_text: string | null;
};

/** What the client keeps per attachment and sends back with each message. */
export type TacoAttachmentRef = {
  id: string;
  kind: 'image' | 'document';
  name: string;
  url: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanAttachmentIds(ids: unknown, max = 20): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && UUID_RE.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Loads attachments by id, only ever the given user's. Pass the admin client
 * (rows are service-role written); the user_id filter is the access check.
 */
export async function loadTacoAttachments(
  admin: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<TacoAttachment[]> {
  if (!ids.length) return [];
  const { data, error } = await asUntyped(admin)
    .from('taco_attachments')
    .select('id, user_id, storage_path, public_url, kind, mime, name, extracted_text')
    .eq('user_id', userId)
    .in('id', ids);
  if (error) {
    console.error('[Taco] loadTacoAttachments failed', error);
    return [];
  }
  const byId = new Map((data as TacoAttachment[]).map((a) => [a.id, a]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

export async function loadTacoAttachment(
  admin: SupabaseClient,
  userId: string,
  id: unknown,
): Promise<TacoAttachment | null> {
  const [clean] = cleanAttachmentIds([id], 1);
  if (!clean) return null;
  const [row] = await loadTacoAttachments(admin, userId, [clean]);
  return row ?? null;
}

/** Rebuilds a File from a stored attachment so existing FormData actions can take it. */
export async function attachmentToFile(admin: SupabaseClient, att: TacoAttachment): Promise<File> {
  const { data, error } = await admin.storage.from('artworks').download(att.storage_path);
  if (error || !data) throw new Error(`Could not read ${att.name}`);
  const bytes = await data.arrayBuffer();
  return new File([bytes], att.name, { type: att.mime });
}
