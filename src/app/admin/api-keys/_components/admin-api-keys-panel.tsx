'use client';

import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PLANETS } from '@provenance/core/types';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  createAdminApiKey,
  revokeAdminApiKey,
  type AdminApiKeyRow,
} from '../_actions/api-keys-admin';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function AdminApiKeysPanel(props: { initialKeys: AdminApiKeyRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plainSecret, setPlainSecret] = useState<string | null>(null);

  const onCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get('name') ?? '').trim();
    const planet = String(fd.get('planet') ?? '');

    startTransition(async () => {
      const res = await createAdminApiKey({ name, planet });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPlainSecret(res.plainSecret);
      form.reset();
      router.refresh();
      toast.success('API key created. Copy it now; it will not be shown again.');
    });
  };

  const onRevoke = (id: string) => {
    startTransition(async () => {
      const res = await revokeAdminApiKey(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
      toast.success('API key revoked');
    });
  };

  const copySecret = async () => {
    if (!plainSecret) return;
    try {
      await navigator.clipboard.writeText(plainSecret);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="space-y-8">
      {plainSecret ? (
        <div className="border-4 border-double border-wine bg-parchment p-6 space-y-3">
          <h2 className="text-xl font-display font-bold text-wine">Your new API key</h2>
          <p className="text-ink/80 font-serif text-sm">
            Copy this value now. For security we only store a hash; you cannot retrieve this secret
            again.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={plainSecret} className="font-mono text-sm" />
            <Button type="button" onClick={copySecret} className="bg-wine text-parchment shrink-0">
              Copy
            </Button>
            <Button type="button" variant="outline" onClick={() => setPlainSecret(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-4 border-double border-wine bg-parchment p-6">
        <h2 className="text-2xl font-display font-bold text-wine mb-4">Create a key</h2>
        <form onSubmit={onCreate} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              id="api-key-name"
              name="name"
              required
              maxLength={255}
              placeholder="e.g. Open Claw production"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key-planet">Planet scope (optional)</Label>
            <select
              id="api-key-planet"
              name="planet"
              disabled={pending}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Any planet</option>
              {PLANETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <p className="text-ink/60 text-xs font-serif">
              If set, the key only works for that vertical on the verification API.
            </p>
          </div>
          <Button type="submit" disabled={pending} className="bg-wine text-parchment hover:bg-wine/90">
            {pending ? 'Creating…' : 'Create API key'}
          </Button>
        </form>
      </div>

      <div className="border-4 border-double border-wine bg-parchment p-6 overflow-x-auto">
        <h2 className="text-2xl font-display font-bold text-wine mb-4">Your keys</h2>
        {props.initialKeys.length === 0 ? (
          <p className="text-ink/70 font-serif text-sm">No API keys yet.</p>
        ) : (
          <table className="w-full text-sm font-serif border-collapse">
            <thead>
              <tr className="border-b border-wine/30 text-left text-ink/70">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Planet</th>
                <th className="py-2 pr-4 font-medium">Scopes</th>
                <th className="py-2 pr-4 font-medium">Active</th>
                <th className="py-2 pr-4 font-medium">Created</th>
                <th className="py-2 pr-4 font-medium">Last used</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.initialKeys.map((row) => (
                <tr key={row.id} className="border-b border-wine/20">
                  <td className="py-2 pr-4">{row.name}</td>
                  <td className="py-2 pr-4">{row.planet ?? 'Any'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {(row.scopes ?? []).join(', ') || '—'}
                  </td>
                  <td className="py-2 pr-4">{row.is_active ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(row.last_used_at)}</td>
                  <td className="py-2">
                    {row.is_active ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        className="border-wine text-wine"
                        onClick={() => onRevoke(row.id)}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-ink/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
