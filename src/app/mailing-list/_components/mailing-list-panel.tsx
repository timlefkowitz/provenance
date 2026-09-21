'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import {
  Search,
  Mail,
  Phone,
  Download,
  Plus,
  Trash2,
  ArrowUpRight,
  UserPlus,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import type { ArtistLead } from '~/app/portal/or/_actions/leads-constants';
import {
  createContact,
  deleteLead,
  promoteContactToLead,
} from '~/app/portal/or/_actions/leads';
import {
  ALL_SOURCES,
  NO_SOURCE,
  displayName,
  filterAndSortContacts,
  sourceLabel,
  sourceOptions,
  type SortDir,
  type SortKey,
} from '../_lib/contact-view';

function escapeCsv(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(contacts: ArtistLead[]) {
  const header = ['Name', 'Email', 'Phone', 'Source', 'Artwork', 'Notes', 'On pipeline'];
  const rows = contacts.map((c) => [
    c.contact_name ?? '',
    c.contact_email ?? '',
    c.contact_phone ?? '',
    sourceLabel(c.source),
    c.artwork?.title ?? '',
    c.notes ?? '',
    c.is_lead ? 'yes' : 'no',
  ]);
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mailing-list-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Hovering a contact reveals the artwork it was linked to (sale, certificate, inquiry…). */
function LinkedArtworkHover({
  artwork,
  children,
}: {
  artwork: ArtistLead['artwork'];
  children: React.ReactNode;
}) {
  if (!artwork) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-default">{children}</div>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        className="bg-white text-ink border border-wine/15 shadow-lg p-2.5 max-w-[260px]"
      >
        <p className="text-[10px] uppercase tracking-wider text-ink/45 font-serif mb-1.5">
          Linked artwork
        </p>
        <div className="flex items-center gap-2.5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-parchment">
            {artwork.image_url ? (
              <Image src={artwork.image_url} alt="" fill className="object-cover" unoptimized />
            ) : (
              <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-ink/25" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-semibold leading-snug text-ink break-words">
              {artwork.title || 'Untitled'}
            </p>
            <Link
              href={`/artworks/${artwork.id}/certificate`}
              className="text-[11px] font-serif text-wine/75 hover:text-wine hover:underline"
            >
              View artwork &rarr;
            </Link>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function MailingListPanel({ initialContacts }: { initialContacts: ArtistLead[] }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ArtistLead[]>(initialContacts);
  const [q, setQ] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>(ALL_SOURCES);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  const sources = useMemo(() => sourceOptions(contacts), [contacts]);

  // A filtered source can disappear (e.g. its last contact deleted); fall back to all.
  const activeSource = sourceFilter === ALL_SOURCES || sources.some((o) => o.value === sourceFilter)
    ? sourceFilter
    : ALL_SOURCES;

  const rows = useMemo(
    () => filterAndSortContacts(contacts, { query: q, source: activeSource, sortKey, sortDir }),
    [contacts, q, activeSource, sortKey, sortDir],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setFormError(null);
    setShowForm(false);
  };

  const handleAdd = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await createContact({
        contact_name: name || null,
        contact_email: email || null,
        contact_phone: phone || null,
        notes: notes || null,
      });
      if (!result.success) {
        setFormError(result.error ?? 'Could not add contact.');
        return;
      }
      resetForm();
      router.refresh();
    });
  };

  const handlePromote = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      const result = await promoteContactToLead(id);
      setPendingId(null);
      if (result.success) {
        setContacts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_lead: true } : c)),
        );
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Remove this contact from your mailing list?')) return;
    setPendingId(id);
    startTransition(async () => {
      const result = await deleteLead(id);
      setPendingId(null);
      if (result.success) {
        setContacts((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/35" />
          <Input
            placeholder="Search contacts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 font-serif text-sm h-10 border-wine/20 rounded-xl"
          />
        </div>
        {sources.length > 0 && (
          <Select value={activeSource} onValueChange={setSourceFilter}>
            <SelectTrigger
              aria-label="Filter by source"
              className="w-[200px] h-10 font-serif text-sm border-wine/20 rounded-xl"
            >
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SOURCES}>All sources ({contacts.length})</SelectItem>
              {sources.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label} ({o.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs font-serif text-ink/40 shrink-0">
          {rows.length} contact{rows.length !== 1 ? 's' : ''}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-serif border-wine/20"
          onClick={() => downloadCsv(rows)}
          disabled={rows.length === 0}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add contact
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl border border-wine/15 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">New contact</h2>
            <Link
              href="/portal/or"
              className="text-xs font-serif text-wine/70 hover:text-wine inline-flex items-center gap-1"
            >
              View in CRM
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ml-name" className="font-serif text-sm">Name</Label>
              <Input
                id="ml-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="font-serif"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-email" className="font-serif text-sm">Email</Label>
              <Input
                id="ml-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="font-serif"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-phone" className="font-serif text-sm">Phone</Label>
              <Input
                id="ml-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
                className="font-serif"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ml-notes" className="font-serif text-sm">Notes</Label>
              <Textarea
                id="ml-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="font-serif min-h-[72px]"
              />
            </div>
          </div>
          {formError && (
            <p className="text-sm text-red-700 font-serif">{formError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={resetForm} className="font-serif">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={isPending || (!name.trim() && !email.trim())}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save contact'}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-wine/20 bg-parchment/30 px-8 py-20 text-center">
          <Mail className="h-10 w-10 text-wine/25 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-ink/50 mb-2">Your mailing list is empty</p>
          <p className="font-serif text-sm text-ink/40 max-w-md mx-auto mb-6">
            Contacts are added automatically when you send certificates of ownership or enter names and emails for exhibitions. You can also add people manually.
          </p>
          <Button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add your first contact
          </Button>
        </div>
      ) : (
        <TooltipProvider delayDuration={150}>
        <div className="rounded-2xl border border-wine/12 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-serif">
              <thead>
                <tr className="bg-parchment/60 border-b border-wine/10">
                  <th
                    className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-ink/50 font-semibold"
                    aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-wine">
                      Contact {sortIcon('name')}
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left hidden sm:table-cell text-[10px] uppercase tracking-wider text-ink/50 font-semibold">
                    Phone
                  </th>
                  <th
                    className="px-5 py-3 text-left hidden md:table-cell text-[10px] uppercase tracking-wider text-ink/50 font-semibold"
                    aria-sort={sortKey === 'source' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" onClick={() => toggleSort('source')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-wine">
                      Source {sortIcon('source')}
                    </button>
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] uppercase tracking-wider text-ink/50 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wine/6">
                {rows.map((contact) => (
                  <tr key={contact.id} className="hover:bg-parchment/40 transition-colors group">
                    <td className="px-5 py-3.5 align-top min-w-0">
                      <LinkedArtworkHover artwork={contact.artwork}>
                      <div className="flex items-start gap-2">
                        <p className="font-semibold text-ink text-sm leading-snug">{displayName(contact)}</p>
                        {contact.artwork && (
                          <Link
                            href={`/artworks/${contact.artwork.id}/certificate`}
                            aria-label={`Linked artwork: ${contact.artwork.title || 'Untitled'}`}
                            className="text-wine/45 hover:text-wine shrink-0 mt-0.5"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {contact.is_lead && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                            Pipeline
                          </span>
                        )}
                      </div>
                      {contact.contact_email && (
                        <a
                          href={`mailto:${contact.contact_email}`}
                          className="text-[11px] text-wine/75 hover:text-wine hover:underline flex items-center gap-1 mt-0.5 break-all"
                        >
                          <Mail className="h-2.5 w-2.5 shrink-0" />
                          {contact.contact_email}
                        </a>
                      )}
                      {contact.notes && (
                        <p className="text-[11px] text-ink/40 mt-0.5 line-clamp-1">{contact.notes}</p>
                      )}
                      </LinkedArtworkHover>
                    </td>
                    <td className="px-5 py-3.5 align-top text-ink/55 text-xs hidden sm:table-cell">
                      {contact.contact_phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {contact.contact_phone}
                        </span>
                      ) : (
                        <span className="text-ink/20">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-top hidden md:table-cell">
                      <button
                        type="button"
                        title="Show only this source"
                        onClick={() => setSourceFilter(contact.source?.trim() || NO_SOURCE)}
                        className="text-[11px] px-2.5 py-0.5 rounded-full bg-wine/8 text-wine/80 font-medium hover:bg-wine/15 transition-colors"
                      >
                        {sourceLabel(contact.source)}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      <div className="flex items-center justify-end gap-1">
                        {!contact.is_lead && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-ink/50 hover:text-wine font-serif text-xs"
                            disabled={pendingId === contact.id || isPending}
                            onClick={() => handlePromote(contact.id)}
                          >
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                            Pipeline
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-ink/40 hover:text-red-700 font-serif text-xs"
                          disabled={pendingId === contact.id || isPending}
                          onClick={() => handleDelete(contact.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (q.trim() || activeSource !== ALL_SOURCES) && (
            <div className="px-5 py-10 text-center">
              <p className="font-serif text-sm text-ink/40">
                No contacts match{q.trim() ? <> &ldquo;{q}&rdquo;</> : ' this filter'}
              </p>
              {activeSource !== ALL_SOURCES && (
                <button
                  type="button"
                  onClick={() => setSourceFilter(ALL_SOURCES)}
                  className="mt-2 text-xs font-serif text-wine/70 hover:text-wine underline"
                >
                  Show all sources
                </button>
              )}
            </div>
          )}
        </div>
        </TooltipProvider>
      )}

      <p className="text-xs font-serif text-ink/35 text-center">
        Contacts from certificates, sales, and exhibitions sync here automatically.{' '}
        <Link href="/portal/or" className="text-wine/70 hover:text-wine underline">
          Open CRM
        </Link>
      </p>
    </div>
  );
}
