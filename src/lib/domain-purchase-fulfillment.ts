import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  configureGoDaddyDnsForVercel,
  purchaseDomainOnGoDaddy,
  registerDomainWithVercel,
} from '~/lib/godaddy';

type DomainPurchaseRow = {
  id: string;
  user_id: string;
  profile_id: string;
  domain: string;
  stripe_checkout_session_id: string;
  status: string;
};

export async function fulfillDomainPurchase(
  checkoutSessionId: string,
  agreedByIp = '127.0.0.1',
): Promise<{ ok: boolean; error?: string }> {
  console.log('[Sites] fulfillDomainPurchase started', { checkoutSessionId });

  const admin = getSupabaseServerAdminClient();

  const { data: purchase, error: fetchErr } = await asUntyped(admin)
    .from('domain_purchases')
    .select('*')
    .eq('stripe_checkout_session_id', checkoutSessionId)
    .maybeSingle();

  if (fetchErr || !purchase) {
    console.error('[Sites] fulfillDomainPurchase: purchase row not found', fetchErr);
    return { ok: false, error: 'purchase_not_found' };
  }

  const row = purchase as DomainPurchaseRow;

  if (row.status === 'purchased') {
    console.log('[Sites] fulfillDomainPurchase: already purchased', { id: row.id });
    return { ok: true };
  }

  if (row.status === 'failed') {
    console.log('[Sites] fulfillDomainPurchase: previously failed', { id: row.id });
    return { ok: false, error: 'already_failed' };
  }

  const domain = row.domain;

  try {
    await purchaseDomainOnGoDaddy(domain, agreedByIp);
    await configureGoDaddyDnsForVercel(domain);
    const vercelVerified = await registerDomainWithVercel(domain);

    const now = new Date().toISOString();
    const { error: siteErr } = await asUntyped(admin)
      .from('profile_sites')
      .update({
        custom_domain: domain,
        custom_domain_verified_at: vercelVerified ? now : null,
        updated_at: now,
      })
      .eq('profile_id', row.profile_id);

    if (siteErr) {
      throw new Error(siteErr.message);
    }

    const { error: updateErr } = await asUntyped(admin)
      .from('domain_purchases')
      .update({ status: 'purchased', error: null, updated_at: now })
      .eq('id', row.id)
      .eq('status', 'pending');

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    console.log('[Sites] fulfillDomainPurchase succeeded', { domain, profileId: row.profile_id });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Sites] fulfillDomainPurchase failed', { domain, err });

    await asUntyped(admin)
      .from('domain_purchases')
      .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    return { ok: false, error: message };
  }
}
