'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Check, Loader2, Lock, Nfc, TriangleAlert, X } from 'lucide-react';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';
import {
  isWritableUrl,
  ndefUrlBytes,
  NFC_TAG_CAPACITIES,
  nfcUnsupportedMessage,
  smallestTagFor,
} from '~/lib/nfc/nfc-writer';
import { useNfcWriter } from '~/lib/nfc/use-nfc-writer';
import { adminButtonPrimary, adminMonoLabel, adminPanel, adminPanelInner } from '../../_components/admin-dash-tokens';

const RECENT_KEY = 'provenance.admin.nfc.recent';
const MAX_RECENT = 8;

const RECENT_EVENT = 'provenance:admin-nfc-recent';

function parseRecent(raw: string): string[] {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function readRecentRaw(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function subscribeRecent(onChange: () => void) {
  window.addEventListener(RECENT_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(RECENT_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Private mode or storage blocked: recent links just aren't remembered.
  }
  window.dispatchEvent(new Event(RECENT_EVENT));
}

/** Adds https:// when someone types a bare domain. */
function normalise(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `https://${value}`;
}

export function AdminNfcWriter() {
  const { support, state, write, cancel, reset } = useNfcWriter();
  const [input, setInput] = useState('');
  const [lock, setLock] = useState(false);
  const recentRaw = useSyncExternalStore(subscribeRecent, readRecentRaw, () => '[]');
  const recent = useMemo(() => parseRecent(recentRaw), [recentRaw]);

  const url = normalise(input);
  const valid = isWritableUrl(url);
  const bytes = valid ? ndefUrlBytes(url) : 0;
  const tag = valid ? smallestTagFor(url) : null;
  const canWrite = support?.kind === 'native' || support?.kind === 'web';
  const waiting = state.phase === 'waiting';

  const handleWrite = async () => {
    if (!valid) return;
    const ok = await write(url, { lock });
    if (ok) {
      saveRecent([url, ...recent.filter((r) => r !== url)]);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className={cn(adminPanel, 'p-5')}>
        <p className={cn(adminMonoLabel, 'mb-3')}>link</p>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://www.provenance.guru/…"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (state.phase !== 'waiting') reset();
          }}
          className="w-full rounded-sm border border-[#1793d1]/30 bg-[#0c0e12] px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#1793d1]/70 focus:outline-none"
        />
        <p className="mt-2 font-mono text-[11px] text-slate-500">
          {!input.trim() ? (
            'Any http(s) link. Bare domains get https:// added.'
          ) : !valid ? (
            <span className="text-amber-400">Not a valid link.</span>
          ) : tag ? (
            <>
              {bytes} bytes on tag · fits <span className="text-slate-300">{tag.name}</span> and larger
            </>
          ) : (
            <span className="text-red-400">
              {bytes} bytes — too long for {NFC_TAG_CAPACITIES[NFC_TAG_CAPACITIES.length - 1].name}. Shorten the link.
            </span>
          )}
        </p>

        <label className={cn(adminPanelInner, 'mt-4 flex cursor-pointer items-start justify-between gap-4 p-3')}>
          <span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-slate-200">
              <Lock className="h-3.5 w-3.5 text-[#67d4ff]" aria-hidden /> lock after writing
            </span>
            <span className="mt-1 block font-mono text-[11px] leading-snug text-slate-500">
              Permanent: a locked tag can never be rewritten or erased.
            </span>
          </span>
          <Switch checked={lock} onCheckedChange={setLock} />
        </label>

        {support?.kind === 'none' && (
          <p className="mt-4 flex gap-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-3 font-mono text-[11px] leading-snug text-amber-300">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            {nfcUnsupportedMessage(support.reason)}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleWrite()}
            disabled={!canWrite || !valid || !tag || waiting}
            className={cn(adminButtonPrimary, 'inline-flex items-center gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40')}
          >
            {waiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Nfc className="h-3.5 w-3.5" />}
            {waiting ? 'waiting for tag…' : 'write tag'}
          </button>
          {waiting && support?.kind === 'web' && (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-400 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" /> cancel
            </button>
          )}
          <span className="font-mono text-[11px] text-slate-500" role="status">
            {waiting && support?.kind === 'web' && 'Hold the tag to the back of the phone.'}
            {state.phase === 'written' && (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <Check className="h-3.5 w-3.5" /> {state.locked ? 'written + locked' : 'written'}
              </span>
            )}
            {state.phase === 'error' && <span className="text-red-400">{state.message}</span>}
          </span>
        </div>
      </section>

      {recent.length > 0 && (
        <section className={cn(adminPanel, 'p-5')}>
          <div className="mb-3 flex items-center justify-between">
            <p className={adminMonoLabel}>recent</p>
            <button
              type="button"
              onClick={() => saveRecent([])}
              className="font-mono text-[11px] text-slate-500 hover:text-slate-300"
            >
              clear
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {recent.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => {
                    setInput(r);
                    reset();
                  }}
                  className="w-full truncate rounded-sm px-2 py-1.5 text-left font-mono text-xs text-[#67d4ff] hover:bg-[#1793d1]/10"
                >
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="font-mono text-[11px] leading-relaxed text-slate-500">
        <p className={cn(adminMonoLabel, 'mb-2')}>notes</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Writes from the Provenance iPhone app (Core NFC) or Chrome on Android (Web NFC).</li>
          <li>
            Capacity: NTAG213 ≈ 144 bytes, NTAG215 ≈ 504, NTAG216 ≈ 888. A certificate link fits an NTAG213.
          </li>
          <li>Links to www.provenance.guru open straight into the app on iPhones that have it.</li>
        </ul>
      </section>
    </div>
  );
}
