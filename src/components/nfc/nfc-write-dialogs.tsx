'use client';

import { useId, useState } from 'react';
import { Check, Copy, Loader2, Lock, Nfc, SmartphoneNfc, TriangleAlert } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { ndefUrlBytes, nfcUnsupportedMessage, smallestTagFor, type NfcSupport } from '~/lib/nfc/nfc-writer';
import { useNfcWriter } from '~/lib/nfc/use-nfc-writer';

// ── Shared pieces ─────────────────────────────────────────────────────────────

function UnsupportedNotice({ support }: { support: NfcSupport | null }) {
  if (!support || support.kind !== 'none') return null;
  return (
    <div className="flex gap-2.5 rounded-sm border border-amber-700/25 bg-amber-50 p-3 text-[13px] leading-snug text-amber-900">
      <SmartphoneNfc className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        {nfcUnsupportedMessage(support.reason)} You can also copy the link and write it with any NFC
        app.
      </p>
    </div>
  );
}

function LockOption({ lock, onLockChange }: { lock: boolean; onLockChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-sm border border-editorial-border p-3">
      <div>
        <label htmlFor={id} className="flex cursor-pointer items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 opacity-60" aria-hidden />
          Lock tag after writing
        </label>
        <p className="mt-1 text-[12px] leading-snug text-editorial-ink/55">
          {lock
            ? 'Permanent. A locked tag can never be changed or erased, so nobody can point it somewhere else.'
            : 'Leave off while testing. Unlocked tags can be rewritten later.'}
        </p>
      </div>
      <Switch
        id={id}
        checked={lock}
        onCheckedChange={onLockChange}
        className="shrink-0 data-[state=checked]:bg-wine"
      />
    </div>
  );
}

function sizeHint(url: string): { text: string; tooBig: boolean } {
  const bytes = ndefUrlBytes(url);
  const tag = smallestTagFor(url);
  if (!tag) return { text: `${bytes} bytes — too long for common NFC stickers`, tooBig: true };
  return { text: `${bytes} bytes · fits ${tag.name} and larger`, tooBig: false };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('[NFC] copy link failed', err);
    toast.error('Could not copy the link.');
    return false;
  }
}

const HOLD_HINT_WEB = 'Hold the NFC tag to the back of your phone…';

// ── Single tag ────────────────────────────────────────────────────────────────

/**
 * Writes one link to an NFC tag: certificates, an exhibition page. Tapping the
 * tag with a phone then opens the link, the same as scanning its QR code.
 */
export function NfcWriteDialog({
  open,
  onOpenChange,
  url,
  title = 'Write NFC tag',
  description,
  itemLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
  description?: string;
  /** What the tag is for, shown above the link (e.g. the artwork title). */
  itemLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <NfcWriteDialogBody url={url} title={title} description={description} itemLabel={itemLabel} />
      )}
    </Dialog>
  );
}

function NfcWriteDialogBody({
  url,
  title,
  description,
  itemLabel,
}: {
  url: string;
  title: string;
  description?: string;
  itemLabel?: string;
}) {
  const { support, state, write, cancel } = useNfcWriter();
  const [lock, setLock] = useState(false);
  const [copied, setCopied] = useState(false);
  const size = sizeHint(url);
  const canWrite = support?.kind === 'native' || support?.kind === 'web';
  const waiting = state.phase === 'waiting';

  return (
    <EditorialDialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description ??
            'Anyone who taps the tag with their phone opens this page, just like scanning the QR code.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3 rounded-sm border border-editorial-border bg-white/60 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine">
          <Nfc className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          {itemLabel && <p className="truncate text-sm text-editorial-ink">{itemLabel}</p>}
          <p className="break-all text-[11px] leading-snug text-editorial-ink/50">{url}</p>
          <p className={cn('mt-0.5 text-[11px]', size.tooBig ? 'text-red-700' : 'text-editorial-ink/40')}>
            {size.text}
          </p>
        </div>
      </div>

      <UnsupportedNotice support={support} />

      {canWrite && <LockOption lock={lock} onLockChange={setLock} />}

      {state.phase === 'waiting' && support?.kind === 'web' && (
        <p className="flex items-center gap-2 text-sm text-editorial-ink/70" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {HOLD_HINT_WEB}
        </p>
      )}
      {state.phase === 'written' && (
        <p className="flex items-center gap-2 text-sm text-emerald-800" role="status">
          <Check className="h-4 w-4" aria-hidden />
          {state.locked ? 'Tag written and locked.' : 'Tag written. Tap it with a phone to check.'}
        </p>
      )}
      {state.phase === 'error' && (
        <p className="flex items-start gap-2 text-sm text-red-700" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            if (await copyText(url)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        {waiting && support?.kind === 'web' ? (
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
        ) : (
          <Button
            onClick={() => void write(url, { lock })}
            disabled={!canWrite || waiting || size.tooBig}
          >
            {waiting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Nfc className="mr-1.5 h-3.5 w-3.5" />
            )}
            {state.phase === 'written' ? 'Write another' : 'Write tag'}
          </Button>
        )}
      </DialogFooter>
    </EditorialDialogContent>
  );
}

// ── Several tags in a row ─────────────────────────────────────────────────────

export type NfcBatchItem = {
  id: string;
  label: string;
  sublabel?: string | null;
  url: string;
};

/**
 * Writes a tag per item, one after another: every work in an exhibition or a
 * collection selection. "Write next" goes down the list; any row can be
 * (re)written on its own.
 */
export function NfcBatchWriteDialog({
  open,
  onOpenChange,
  items,
  title = 'Write NFC tags',
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NfcBatchItem[];
  title?: string;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <NfcBatchWriteBody items={items} title={title} description={description} />}
    </Dialog>
  );
}

function NfcBatchWriteBody({
  items,
  title,
  description,
}: {
  items: NfcBatchItem[];
  title: string;
  description?: string;
}) {
  const { support, state, write, cancel } = useNfcWriter();
  const [lock, setLock] = useState(false);
  const [written, setWritten] = useState<Record<string, 'written' | 'locked'>>({});
  const canWrite = support?.kind === 'native' || support?.kind === 'web';
  const waiting = state.phase === 'waiting';
  const next = items.find((i) => !written[i.id]);
  const doneCount = items.filter((i) => written[i.id]).length;

  const writeItem = async (item: NfcBatchItem) => {
    const ok = await write(item.url, {
      key: item.id,
      lock,
      prompt: `Hold your iPhone near the tag for “${item.label}”.`,
    });
    if (ok) setWritten((prev) => ({ ...prev, [item.id]: lock ? 'locked' : 'written' }));
  };

  return (
    <EditorialDialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description ??
            'Write each link to its own sticker. Tapping a tag with a phone opens that page, just like scanning its QR code.'}
        </DialogDescription>
      </DialogHeader>

      <UnsupportedNotice support={support} />

      {canWrite && <LockOption lock={lock} onLockChange={setLock} />}

      <div className="flex items-center justify-between text-[12px] text-editorial-ink/55">
        <span>
          {doneCount} of {items.length} written
        </span>
        {waiting && support?.kind === 'web' && (
          <span className="flex items-center gap-1.5" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {HOLD_HINT_WEB}
          </span>
        )}
      </div>

      <ul className="-mt-2 divide-y divide-editorial-border border-y border-editorial-border">
        {items.map((item) => {
          const done = written[item.id];
          const busy = waiting && state.key === item.id;
          const error = state.phase === 'error' && state.key === item.id ? state.message : null;
          const size = sizeHint(item.url);
          return (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]',
                  done ? 'border-emerald-700/40 bg-emerald-50 text-emerald-800' : 'border-editorial-border text-editorial-ink/40',
                )}
                aria-hidden
              >
                {done === 'locked' ? <Lock className="h-3 w-3" /> : done ? <Check className="h-3.5 w-3.5" /> : <Nfc className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-editorial-ink">{item.label}</p>
                {item.sublabel && <p className="truncate text-[12px] text-editorial-ink/50">{item.sublabel}</p>}
                {error && <p className="text-[12px] text-red-700">{error}</p>}
                {size.tooBig && <p className="text-[12px] text-red-700">{size.text}</p>}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2.5 text-xs"
                disabled={!canWrite || waiting || size.tooBig}
                onClick={() => void writeItem(item)}
                aria-label={`${done ? 'Rewrite' : 'Write'} tag for ${item.label}`}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? 'Rewrite' : 'Write'}
              </Button>
            </li>
          );
        })}
      </ul>

      <DialogFooter className="gap-2 sm:gap-2">
        {waiting && support?.kind === 'web' ? (
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
        ) : (
          <Button
            className="max-w-full"
            onClick={() => next && void writeItem(next)}
            disabled={!canWrite || waiting || !next}
          >
            <Nfc className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{next ? `Write next: ${next.label}` : 'All tags written'}</span>
          </Button>
        )}
      </DialogFooter>
    </EditorialDialogContent>
  );
}
