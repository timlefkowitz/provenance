'use server';

import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isAdmin } from '~/lib/admin';
import { isValidPlanet } from '@provenance/core/types';

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    planet: z.string().trim().optional(),
  })
  .transform((o) => ({
    name: o.name,
    planet: !o.planet || o.planet === '' ? null : o.planet,
  }))
  .superRefine((o, ctx) => {
    if (o.planet !== null && !isValidPlanet(o.planet)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid planet',
        path: ['planet'],
      });
    }
  });

function hashApiKeySecret(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export type AdminApiKeyRow = {
  id: string;
  name: string;
  scopes: string[] | null;
  planet: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
};

export async function createAdminApiKey(input: {
  name: string;
  planet: string;
}): Promise<{ ok: true; plainSecret: string } | { ok: false; error: string }> {
  console.log('[Admin/API keys] createAdminApiKey started');

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    console.error('[Admin/API keys] createAdminApiKey validation failed', parsed.error);
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Admin/API keys] createAdminApiKey not authenticated');
    return { ok: false, error: 'Not signed in' };
  }

  if (!(await isAdmin(user.id))) {
    console.error('[Admin/API keys] createAdminApiKey forbidden', { userId: user.id });
    return { ok: false, error: 'Forbidden' };
  }

  const plainSecret = `pk_prov_${randomBytes(24).toString('base64url')}`;
  const key_hash = hashApiKeySecret(plainSecret);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- api_keys not in generated DB types yet
  const { error } = await (client as any).from('api_keys').insert({
    account_id: user.id,
    key_hash,
    name: parsed.data.name,
    scopes: ['verify', 'assets:write'],
    planet: parsed.data.planet,
    is_active: true,
  });

  if (error) {
    console.error('[Admin/API keys] createAdminApiKey insert failed', error);
    return { ok: false, error: error.message };
  }

  console.log('[Admin/API keys] createAdminApiKey succeeded', { name: parsed.data.name });
  revalidatePath('/admin/api-keys');
  return { ok: true, plainSecret };
}

const revokeSchema = z.object({
  id: z.string().uuid(),
});

export async function revokeAdminApiKey(
  keyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[Admin/API keys] revokeAdminApiKey started');

  const parsed = revokeSchema.safeParse({ id: keyId });
  if (!parsed.success) {
    return { ok: false, error: 'Invalid key id' };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Admin/API keys] revokeAdminApiKey not authenticated');
    return { ok: false, error: 'Not signed in' };
  }

  if (!(await isAdmin(user.id))) {
    console.error('[Admin/API keys] revokeAdminApiKey forbidden', { userId: user.id });
    return { ok: false, error: 'Forbidden' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- api_keys not in generated DB types yet
  const { data: updated, error } = await (client as any)
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', parsed.data.id)
    .eq('account_id', user.id)
    .select('id');

  if (error) {
    console.error('[Admin/API keys] revokeAdminApiKey update failed', error);
    return { ok: false, error: error.message };
  }

  if (!updated?.length) {
    console.log('[Admin/API keys] revokeAdminApiKey no row updated', { keyId: parsed.data.id });
    return { ok: false, error: 'Key not found' };
  }

  console.log('[Admin/API keys] revokeAdminApiKey succeeded', { keyId: parsed.data.id });
  revalidatePath('/admin/api-keys');
  return { ok: true };
}
