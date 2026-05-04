'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type AttachDomainResult =
  | { success: true; verified: boolean; cnameTarget: string }
  | { success: false; error: string };

/**
 * (v1.5) Attach a custom domain to the user's creator site.
 *
 * Flow:
 *  1. Validates user owns the profile site
 *  2. Calls Vercel Domains API to register the domain on this project
 *  3. Saves the domain to profile_sites.custom_domain
 *  4. Returns DNS instructions and initial verification status
 *
 * Environment variables required:
 *   VERCEL_API_TOKEN   — personal access token with projects:write scope
 *   VERCEL_PROJECT_ID  — Vercel project ID
 */
export async function attachCustomDomainAction(
  profileId: string,
  domain: string,
): Promise<AttachDomainResult> {
  console.log('[Sites] attachCustomDomainAction', { profileId, domain });

  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return {
      success: false,
      error: 'Custom domain feature is not configured on this deployment.',
    };
  }

  const client = getSupabaseServerClient();

  // Auth check
  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Ownership check
  const { data: siteRow, error: siteErr } = await (client as any)
    .from('profile_sites')
    .select('profile_id, handle')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (siteErr || !siteRow) {
    return { success: false, error: 'Site not found. Save your site first.' };
  }

  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('user_id')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile || profile.user_id !== user.id) {
    return { success: false, error: 'Profile not owned by you' };
  }

  // Normalize domain
  const normalizedDomain = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!normalizedDomain || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(normalizedDomain)) {
    return { success: false, error: 'Invalid domain format. Example: myartist.com' };
  }

  // Register with Vercel Domains API
  const vercelRes = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/domains`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: normalizedDomain }),
    },
  );

  if (!vercelRes.ok) {
    const body = await vercelRes.json().catch(() => ({}));
    console.error('[Sites] Vercel Domains API error', body);
    const msg = (body as any)?.error?.message ?? 'Failed to register domain with Vercel';
    return { success: false, error: msg };
  }

  const vercelData = await vercelRes.json();
  const verified: boolean = vercelData.verified ?? false;

  // Persist to DB
  const now = new Date().toISOString();
  const { error: updateErr } = await (client as any)
    .from('profile_sites')
    .update({
      custom_domain: normalizedDomain,
      custom_domain_verified_at: verified ? now : null,
      updated_at: now,
    })
    .eq('profile_id', profileId);

  if (updateErr) {
    console.error('[Sites] attachCustomDomainAction DB update failed', updateErr);
    return { success: false, error: updateErr.message };
  }

  console.log('[Sites] attachCustomDomainAction done', { domain: normalizedDomain, verified });
  return { success: true, verified, cnameTarget: 'cname.vercel-dns.com' };
}

/**
 * (v1.5) Poll Vercel to check if the custom domain has been verified.
 * Call periodically from the UI after DNS is configured.
 */
export type VerifyDomainResult =
  | { verified: true }
  | { verified: false; pending: true }
  | { verified: false; pending: false; error: string };

export async function pollCustomDomainVerification(
  profileId: string,
): Promise<VerifyDomainResult> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return { verified: false, pending: false, error: 'Not configured' };
  }

  const client = getSupabaseServerClient();

  const { data: siteRow } = await (client as any)
    .from('profile_sites')
    .select('custom_domain, custom_domain_verified_at')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (!siteRow?.custom_domain) {
    return { verified: false, pending: false, error: 'No custom domain set' };
  }

  if (siteRow.custom_domain_verified_at) {
    return { verified: true };
  }

  // Check Vercel
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains/${siteRow.custom_domain}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    return { verified: false, pending: true };
  }

  const data = await res.json();
  if (data.verified) {
    const now = new Date().toISOString();
    await (client as any)
      .from('profile_sites')
      .update({ custom_domain_verified_at: now, updated_at: now })
      .eq('profile_id', profileId);

    console.log('[Sites] pollCustomDomainVerification: domain verified', { domain: siteRow.custom_domain });
    return { verified: true };
  }

  return { verified: false, pending: true };
}
