'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from 'sonner';

import type { AdminContactRow } from '../_actions/admin-contacts';
import {
  createAdminContact,
  deleteAdminContact,
} from '../_actions/admin-contacts';

type Props = { initialContacts: AdminContactRow[] };

export function AdminContactsPanel({ initialContacts }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onCreate(formData: FormData) {
    const displayName = String(formData.get('displayName') ?? '');
    const email = String(formData.get('email') ?? '');
    const phone = String(formData.get('phone') ?? '');
    const company = String(formData.get('company') ?? '');
    const website = String(formData.get('website') ?? '');
    const notes = String(formData.get('notes') ?? '');

    setPending(true);
    console.log('[AdminContactsPanel] submit create');
    try {
      const r = await createAdminContact({
        displayName,
        email,
        phone,
        company,
        website,
        notes,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Contact saved');
      (document.getElementById('admin-contact-form') as HTMLFormElement | null)?.reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    const r = await deleteAdminContact(id);
    setDeletingId(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success('Removed');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-md border border-white/10 bg-black/20 p-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-[#1793d1]/80">
          new contact
        </p>
        <form id="admin-contact-form" action={onCreate} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="displayName" className="mb-1 block font-mono text-[11px] text-slate-500">
              name *
            </label>
            <input
              id="displayName"
              name="displayName"
              required
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block font-mono text-[11px] text-slate-500">
              email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block font-mono text-[11px] text-slate-500">
              phone
            </label>
            <input
              id="phone"
              name="phone"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </div>
          <div>
            <label htmlFor="company" className="mb-1 block font-mono text-[11px] text-slate-500">
              company
            </label>
            <input
              id="company"
              name="company"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </div>
          <div>
            <label htmlFor="website" className="mb-1 block font-mono text-[11px] text-slate-500">
              website
            </label>
            <input
              id="website"
              name="website"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="mb-1 block font-mono text-[11px] text-slate-500">
              notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={pending}
              variant="outline"
              className="font-mono text-[13px] border-[#1793d1]/40 text-[#67d4ff] hover:bg-[#1793d1]/15"
            >
              {pending ? 'saving…' : 'add contact'}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-[#1793d1]/80">
          contact list ({initialContacts.length})
        </p>
        {initialContacts.length === 0 ? (
          <p className="font-mono text-sm text-slate-500">No contacts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-white/10">
            <table className="w-full min-w-[720px] border-collapse font-mono text-[13px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-[#1793d1]/70">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Reach</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 w-24 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {initialContacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/[0.06] text-slate-300 hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-100">{c.display_name}</div>
                      {c.notes && (
                        <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                          {c.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-[12px]">
                      {c.email && <div>{c.email}</div>}
                      {c.phone && <div className="text-slate-500">{c.phone}</div>}
                      {c.website && (
                        <a
                          href={
                            c.website.startsWith('http') ? c.website : `https://${c.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#67d4ff] underline-offset-2 hover:underline break-all"
                        >
                          {c.website}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-400">{c.company ?? '—'}</td>
                    <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                      {c.source}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === c.id}
                        className="font-mono text-xs text-red-400/90 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => void onDelete(c.id)}
                      >
                        {deletingId === c.id ? '…' : 'remove'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
