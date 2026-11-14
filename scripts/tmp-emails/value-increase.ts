/**
 * One-off: tell every collector that their work's Provenance Value went up
 * because it was exhibited, published or sold.
 *
 *   tsx value-increase.ts build            → finds collectors + works, caches to ./out, writes a preview
 *   tsx value-increase.ts test <email>     → sends the richest cached email to <email> (no claim link created)
 *   tsx value-increase.ts send --confirm [--limit N]
 *
 * Who counts: the latest buyer of each work (sales ledger or a certificate
 * marked sold), plus anyone holding an unsold Certificate of Ownership.
 * Sellers buying from themselves, test addresses and digest opt-outs are skipped.
 *
 * Links: a collector who holds the CoO gets its certificate link (they see the
 * value as owner). A buyer who hasn't accepted their CoO gets a fresh 14-day
 * claim link, created only at send time; their old open invites for that work
 * are cancelled first so only one is live.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildBulletproofButtonTable, buildEmailHtml, escapeHtml, type EmailTheme } from '../../src/lib/email-layout';
import { mergeEmailSettingsIntoTheme } from '../../src/lib/email-layout-presets';
import { expandChain } from '../../src/lib/sales/load-chain-sales';
import { loadChainProvenanceValues } from '../../src/lib/valuation/load-chain-provenance-values';
import { formatProvenanceAmount, type ProvenanceValue } from '../../src/lib/valuation/provenance-value';
import { generateClaimToken, hashClaimToken } from '../../src/lib/certificate-claims/tokens';
import { isShownInExhibition } from '../../src/app/exhibitions/_helpers/exhibition-submission-status';
import type { UntypedSupabaseClient } from '../../src/lib/supabase-untyped';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const CACHE = join(OUT, 'value-increase.json');
const LOG = join(OUT, 'sent-value-increase.log');
const SITE = 'https://www.provenance.guru';
const CONTACT = 'dev@provenance.guru';
const SUBJECT = 'Your artwork just went up in Provenance Value';
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const admin = db as unknown as UntypedSupabaseClient;

type Work = {
  /** Certificate the sale was recorded on (the claim source when there's no CoO yet). */
  saleCertId: string;
  saleCertType: string;
  /** The collector's own CoO, when they accepted it. */
  cooId: string | null;
  title: string;
  artist: string;
  imageUrl: string | null;
  value: ProvenanceValue;
  exhibitions: string[];
};

type Recipient = { email: string; name: string; accountId: string | null; works: Work[] };

// ── Collectors ─────────────────────────────────────────────────────────────

type Sale = {
  artwork_id: string;
  sold_to_account_id: string | null;
  sold_to_email: string | null;
  sold_to_name: string | null;
  sold_at: string | null;
};

async function all<T>(table: string, cols: string, apply?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

async function build(): Promise<Recipient[]> {
  const [ledger, soldRows, coos] = await Promise.all([
    all<Sale>('sales_ledger', 'artwork_id, sold_to_account_id, sold_to_email, sold_to_name, sold_at'),
    all<Sale>('artworks', 'artwork_id:id, sold_to_account_id, sold_to_email, sold_to_name, sold_at', (q) =>
      q.or('is_sold.eq.true,sold_at.not.is.null'),
    ),
    all<{ id: string; account_id: string | null; is_sold: boolean | null; sold_at: string | null }>(
      'artworks',
      'id, account_id, is_sold, sold_at',
      (q) => q.eq('certificate_type', 'ownership'),
    ),
  ]);

  const chain = await expandChain(admin, [
    ...ledger.map((s) => s.artwork_id),
    ...soldRows.map((s) => s.artwork_id),
    ...coos.map((c) => c.id),
  ]);
  const keyOf = (id: string) => chain.workKeys.get(id) ?? id;
  const rowById = new Map(chain.rows.map((r) => [r.id, r]));

  // Latest buyer per work.
  const latest = new Map<string, Sale>();
  for (const s of [...ledger, ...soldRows]) {
    if (!s.sold_to_account_id && !s.sold_to_email) continue;
    const k = keyOf(s.artwork_id);
    const cur = latest.get(k);
    if (!cur || (s.sold_at ?? '') > (cur.sold_at ?? '') || (!cur.sold_to_account_id && s.sold_to_account_id && s.sold_at === cur.sold_at)) {
      latest.set(k, s);
    }
  }

  type Holding = { key: string; accountId: string | null; email: string | null; name: string | null; saleCertId: string; cooId: string | null };
  const holdings: Holding[] = [];
  const cooByWorkAndAccount = new Map<string, string>();
  for (const c of coos) {
    if (c.is_sold || c.sold_at || !c.account_id) continue;
    cooByWorkAndAccount.set(`${keyOf(c.id)}|${c.account_id}`, c.id);
  }
  for (const [k, s] of latest) {
    holdings.push({
      key: k,
      accountId: s.sold_to_account_id,
      email: s.sold_to_email,
      name: s.sold_to_name,
      saleCertId: s.artwork_id,
      cooId: s.sold_to_account_id ? cooByWorkAndAccount.get(`${k}|${s.sold_to_account_id}`) ?? null : null,
    });
  }
  // CoO holders the latest sale didn't name (a transfer with no ledger row).
  for (const [wk, cooId] of cooByWorkAndAccount) {
    const [k, accountId] = wk.split('|') as [string, string];
    if (latest.get(k)?.sold_to_account_id === accountId) continue;
    if (latest.has(k) && latest.get(k)!.sold_to_account_id) continue; // sold on to someone else
    holdings.push({ key: k, accountId, email: null, name: null, saleCertId: rowById.get(cooId)?.source_artwork_id ?? cooId, cooId });
  }

  // Accounts: emails, names, opt-outs.
  const accountIds = Array.from(new Set(holdings.map((h) => h.accountId).filter((x): x is string => !!x)));
  const accounts = new Map<string, { email: string | null; name: string | null }>();
  for (let i = 0; i < accountIds.length; i += 200) {
    const { data } = await db.from('accounts').select('id, email, name').in('id', accountIds.slice(i, i + 200));
    for (const a of data ?? []) accounts.set(a.id as string, { email: a.email as string | null, name: a.name as string | null });
  }
  const { data: optOuts, error: optErr } = await db.from('email_preferences').select('user_id').eq('digest_opt_out', true);
  if (optErr) throw new Error(`Cannot read opt-outs, refusing to continue: ${optErr.message}`);
  const blocked = new Set((optOuts ?? []).map((r) => r.user_id as string));

  // Values, exhibition titles and work details.
  const values = await loadChainProvenanceValues(admin, holdings.map((h) => h.saleCertId));
  const { data: links } = await db
    .from('exhibition_artworks')
    .select('artwork_id, status, exhibitions!exhibition_artworks_exhibition_id_fkey(id, title)')
    .in('artwork_id', chain.ids);
  const showsByWork = new Map<string, Map<string, string>>();
  for (const l of (links ?? []) as Array<{ artwork_id: string; status: string | null; exhibitions: any }>) {
    if (!isShownInExhibition(l.status)) continue;
    const ex = Array.isArray(l.exhibitions) ? l.exhibitions[0] : l.exhibitions;
    if (!ex?.title) continue;
    const k = keyOf(l.artwork_id);
    if (!showsByWork.has(k)) showsByWork.set(k, new Map());
    showsByWork.get(k)!.set(ex.id, ex.title);
  }
  const certIds = Array.from(new Set(holdings.map((h) => h.saleCertId)));
  const certs = new Map<string, { title: string | null; artist_name: string | null; image_url: string | null; certificate_type: string | null; account_id: string | null; artist_account_id: string | null }>();
  for (let i = 0; i < certIds.length; i += 200) {
    const { data } = await db
      .from('artworks')
      .select('id, title, artist_name, image_url, certificate_type, account_id, artist_account_id')
      .in('id', certIds.slice(i, i + 200));
    for (const c of data ?? []) certs.set(c.id as string, c as any);
  }

  const byEmail = new Map<string, Recipient>();
  for (const h of holdings) {
    const value = values.get(h.saleCertId);
    const cert = certs.get(h.saleCertId);
    if (!value || !cert) continue;
    if (h.accountId && (h.accountId === cert.account_id || h.accountId === cert.artist_account_id)) continue; // self-sale
    if (h.accountId && blocked.has(h.accountId)) continue;
    const acct = h.accountId ? accounts.get(h.accountId) : undefined;
    const email = (acct?.email || h.email || '').trim().toLowerCase();
    if (!email.includes('@') || /^appreview/.test(email) || /@(example\.com|test\.com)$/.test(email)) continue;
    const r = byEmail.get(email) ?? { email, name: acct?.name || h.name || '', accountId: h.accountId, works: [] };
    const same = r.works.find((w) => keyOf(w.saleCertId) === h.key);
    if (same) {
      // An email-only sale whose buyer has since accepted the CoO: link the CoO, no new claim.
      if (h.cooId && !same.cooId) same.cooId = h.cooId;
      continue;
    }
    r.works.push({
      saleCertId: h.saleCertId,
      saleCertType: cert.certificate_type || 'authenticity',
      cooId: h.cooId,
      title: cert.title || 'Untitled',
      artist: cert.artist_name || '',
      imageUrl: cert.image_url,
      value,
      exhibitions: Array.from(showsByWork.get(h.key)?.values() ?? []),
    });
    byEmail.set(email, r);
  }
  return Array.from(byEmail.values()).sort((a, b) => b.works.length - a.works.length);
}

// ── Claim links (send time only) ───────────────────────────────────────────

async function freshClaimUrl(work: Work, email: string): Promise<string> {
  const claimKind = work.saleCertType === 'show' ? 'owner_coownership_from_cos' : 'owner_coownership_from_coa';
  const { data: creator } = await db.from('artworks').select('account_id').eq('id', work.saleCertId).maybeSingle();
  await db
    .from('certificate_claim_invites')
    .update({ status: 'cancelled' })
    .eq('source_artwork_id', work.saleCertId)
    .eq('invitee_email', email)
    .eq('claim_kind', claimKind)
    .in('status', ['pending', 'pending_owner_approval', 'sent']);
  const token = generateClaimToken();
  const { error } = await db.from('certificate_claim_invites').insert({
    source_artwork_id: work.saleCertId,
    claim_kind: claimKind,
    invitee_email: email,
    token_hash: hashClaimToken(token),
    batch_id: crypto.randomUUID(),
    status: 'sent',
    expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    created_by: (creator?.account_id as string | null) ?? null,
  });
  if (error) throw new Error(`invite for ${work.saleCertId}: ${error.message}`);
  return `${SITE}/claim/certificate?${new URLSearchParams({ token })}`;
}

// ── Rendering ──────────────────────────────────────────────────────────────

async function loadTheme(): Promise<EmailTheme> {
  const { data } = await db.from('email_settings').select('layout_preset, masthead_title, masthead_subtitle').limit(1).maybeSingle();
  return mergeEmailSettingsIntoTheme(data ?? {});
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first && !first.includes('@') ? first : 'there';
}

function why(w: Work): string {
  return w.value.premiums
    .map((p) => {
      const pct = `+${Math.round(p.rate * 100)}%`;
      if (p.label === 'Exhibited') {
        const shows = w.exhibitions.length ? ` in ${w.exhibitions.slice(0, 2).map((t) => `&ldquo;${escapeHtml(t)}&rdquo;`).join(' and ')}` : '';
        return `Exhibited${shows} ${pct}`;
      }
      if (p.label === 'Published') return `Published ${pct}`;
      return `${escapeHtml(p.label)} (a recorded sale proves the price) ${pct}`;
    })
    .join('<br>');
}

function workBlock(w: Work, link: string | null, t: EmailTheme): string {
  const img = w.imageUrl
    ? `<td width="96" valign="top" style="width:96px;padding:0 16px 0 0;"><img src="${escapeHtml(w.imageUrl)}" width="96" alt="" style="display:block;width:96px;height:auto;border:0;"></td>`
    : '';
  const title = link
    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;">${escapeHtml(w.title)}</a>`
    : escapeHtml(w.title);
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-bottom:1px solid ${t.cardBorder};">
  <tr>${img}
    <td valign="top" style="padding:16px 0;">
      <p style="margin:0;font-family:${t.fontFamilyHeading};font-size:18px;font-weight:600;color:${t.ink};">${title}</p>
      ${w.artist ? `<p style="margin:2px 0 8px;font-family:${t.fontFamily};font-size:14px;color:${t.inkMuted};">${escapeHtml(w.artist)}</p>` : ''}
      <p style="margin:0;font-family:${t.fontFamily};font-size:15px;color:${t.ink};">
        ${escapeHtml(formatProvenanceAmount(w.value.base, w.value.currency))} &rarr;
        <strong style="color:${t.wine};">${escapeHtml(formatProvenanceAmount(w.value.total, w.value.currency))}</strong>
      </p>
      <p style="margin:6px 0 0;font-family:${t.fontFamily};font-size:13px;line-height:1.6;color:${t.inkMuted};">${why(w)}</p>
    </td>
  </tr>
</table>`;
}

function render(r: Recipient, links: Map<string, string | null>, t: EmailTheme): string {
  const one = r.works.length === 1;
  const needsClaim = r.works.some((w) => !w.cooId);
  const firstLink = links.get(r.works[0]!.saleCertId) ?? null;
  const body = `
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">${one ? 'Its documented history' : 'Their documented history'} now adds to what ${one ? 'it is' : 'they are'} worth.&#8203;&nbsp;</div>
<p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Hi ${escapeHtml(firstName(r.name))},</p>
<p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Good news about ${one ? 'the work' : 'the works'} you collected. On Provenance, every show, publication and recorded sale in a work&rsquo;s history adds to its <strong>Provenance Value</strong>, and ${one ? 'yours has' : 'yours have'} gone up:</p>
${r.works.map((w) => workBlock(w, links.get(w.saleCertId) ?? null, t)).join('')}
<p style="margin:20px 0 16px;font-family:${t.fontFamily};font-size:15px;line-height:1.7;color:${t.ink};">${
    needsClaim
      ? `Accept your Certificate of Ownership to keep ${one ? 'this' : 'these'} in your collection. You&rsquo;ll see the value and the full history on the certificate, and it updates as the work is shown and sold.`
      : `Your Certificate of Ownership shows the value and the full history, and it updates as the work is shown and sold.`
  }</p>
${firstLink ? buildBulletproofButtonTable(firstLink, needsClaim ? 'Accept your certificate' : 'View your certificate', t) : ''}
<p style="margin:20px 0 16px;font-family:${t.fontFamily};font-size:13px;line-height:1.6;color:${t.inkMuted};">Provenance Value is the artist&rsquo;s price plus set premiums for a documented history (exhibited +10%, published +5%, +5% per recorded sale). It is not an appraisal. For insurance or resale, ask for a formal valuation.${needsClaim ? ' Certificate links work for 14 days.' : ''}</p>
<p style="margin:0 0 4px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Best,</p>
<p style="margin:0;font-family:${t.fontFamilyHeading};font-size:17px;font-style:italic;color:${t.ink};">Tim</p>
<p style="margin:2px 0 0;font-family:${t.fontFamily};font-size:13px;color:${t.inkMuted};">Founder, Provenance</p>
<p style="margin:28px 0 0;font-family:${t.fontFamily};font-size:12px;line-height:1.6;color:${t.inkMuted};">Prefer not to receive these? Email <a href="mailto:${CONTACT}?subject=Unsubscribe" style="color:${t.wine};text-decoration:none;">${CONTACT}</a> and we will take you off the list.</p>`;
  return buildEmailHtml(SUBJECT, `<div>${body}</div>`, t);
}

/** Links without side effects: CoO pages, and a placeholder where a claim link will go. */
function previewLinks(r: Recipient): Map<string, string | null> {
  return new Map(
    r.works.map((w) => [w.saleCertId, w.cooId ? `${SITE}/artworks/${w.cooId}/certificate` : `${SITE}/claim/certificate?token=PREVIEW`]),
  );
}

async function sendLinks(r: Recipient): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const w of r.works) {
    out.set(w.saleCertId, w.cooId ? `${SITE}/artworks/${w.cooId}/certificate` : await freshClaimUrl(w, r.email));
  }
  return out;
}

// ── CLI ────────────────────────────────────────────────────────────────────

function argNum(flag: string): number {
  const i = process.argv.indexOf(flag);
  return i > 0 ? Number(process.argv[i + 1]) : Infinity;
}

function readCache(): Recipient[] {
  if (!existsSync(CACHE)) throw new Error('No cache yet. Run `build` first.');
  return JSON.parse(readFileSync(CACHE, 'utf8')) as Recipient[];
}

async function main() {
  const [mode, arg1] = process.argv.slice(2);
  const theme = await loadTheme();
  mkdirSync(OUT, { recursive: true });

  if (mode === 'build') {
    const recipients = await build();
    writeFileSync(CACHE, JSON.stringify(recipients, null, 2));
    const sample = recipients[0];
    if (sample) writeFileSync(join(OUT, 'value-increase-preview.html'), render(sample, previewLinks(sample), theme));
    for (const r of recipients) {
      console.log(
        `${r.email} (${r.accountId ? 'account' : 'email only'}): ` +
          r.works
            .map((w) => `${w.title} ${formatProvenanceAmount(w.value.base, w.value.currency)}→${formatProvenanceAmount(w.value.total, w.value.currency)} [${w.value.premiums.map((p) => p.label).join(', ')}]${w.cooId ? ' CoO' : ' claim'}`)
            .join('; '),
      );
    }
    console.log(`${recipients.length} recipients, ${recipients.reduce((n, r) => n + r.works.length, 0)} works. Cache: ${CACHE}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';
  const sendOne = async (to: string, html: string) => {
    const { error } = await resend.emails.send({ from, to, replyTo: CONTACT, subject: SUBJECT, html });
    if (error) throw new Error(`${to}: ${error.message}`);
  };

  if (mode === 'test') {
    if (!arg1) throw new Error('Pass a test address');
    const sample = readCache()[0];
    if (!sample) throw new Error('Cache is empty');
    await sendOne(arg1, render({ ...sample, name: 'Tim' }, previewLinks(sample), theme));
    console.log(`Test sent to ${arg1}`);
    return;
  }

  if (mode === 'send') {
    if (!process.argv.includes('--confirm')) throw new Error('Refusing to send without --confirm');
    const already = new Set(existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : []);
    const queue = readCache().filter((r) => !already.has(r.email)).slice(0, argNum('--limit'));
    console.log(`Sending "${SUBJECT}" to ${queue.length} (${already.size} already sent)`);
    let ok = 0;
    for (const r of queue) {
      try {
        await sendOne(r.email, render(r, await sendLinks(r), theme));
        appendFileSync(LOG, `${r.email}\n`);
        ok++;
      } catch (err) {
        console.error('FAILED', (err as Error).message);
        if (/limit|quota/i.test((err as Error).message)) break;
      }
      await new Promise((res) => setTimeout(res, 600)); // Resend: 2 req/s
    }
    console.log(`Done: ${ok}/${queue.length} sent`);
    return;
  }

  throw new Error('Usage: build | test <email> | send --confirm [--limit N]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
