'use client';

import { useMemo, useState } from 'react';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { Search, Mail, Phone, Pencil } from 'lucide-react';
import { STAGE_STYLES, STAGE_LABELS, type ArtistLead, type LeadStage } from '../_actions/leads-constants';

function fmt(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function displayName(lead: ArtistLead) {
  return lead.contact_name?.trim() || lead.contact_email || 'No name';
}

export function CrmContactsList({
  leads,
  onEditContact,
}: {
  leads: ArtistLead[];
  onEditContact: (lead: ArtistLead) => void;
}) {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    if (!q.trim()) {
      return [...leads].sort((a, b) => displayName(a).localeCompare(displayName(b)));
    }
    const s = q.toLowerCase();
    return leads
      .filter(
        (l) =>
          l.contact_name?.toLowerCase().includes(s) ||
          l.contact_email?.toLowerCase().includes(s) ||
          l.contact_phone?.toLowerCase().includes(s) ||
          l.notes?.toLowerCase().includes(s),
      )
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [leads, q]);

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-wine/20 bg-parchment/30 px-8 py-16 text-center">
        <p className="font-serif text-ink/50 text-sm">No contacts yet. Add people from the CRM board.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/55 font-serif max-w-2xl">
        Everyone you add in CRM appears here as a contact list. Use search to find someone quickly, or edit to open them on the board.
      </p>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/35" />
        <Input
          placeholder="Search by name, email, phone, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8 font-serif text-sm h-10 border-wine/20 rounded-xl"
        />
      </div>

      <div className="rounded-2xl border border-wine/12 overflow-hidden bg-white/80">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-serif">
            <thead>
              <tr className="bg-parchment/70 border-b border-wine/10 text-left">
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-ink/45 font-semibold">Contact</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-ink/45 font-semibold hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-ink/45 font-semibold hidden md:table-cell">Stage</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-ink/45 font-semibold text-right">Value</th>
                <th className="px-2 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-wine/8">
              {rows.map((lead) => {
                const styles = STAGE_STYLES[lead.stage as LeadStage];
                return (
                  <tr key={lead.id} className="hover:bg-parchment/50 transition-colors group">
                    <td className="px-4 py-3 align-top min-w-0">
                      <p className="font-semibold text-ink text-sm">{displayName(lead)}</p>
                      {lead.contact_email && (
                        <a
                          href={`mailto:${lead.contact_email}`}
                          className="text-xs text-wine/80 hover:underline flex items-center gap-1 mt-0.5 break-all"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          {lead.contact_email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-ink/60 text-xs hidden sm:table-cell">
                      {lead.contact_phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {lead.contact_phone}
                        </span>
                      ) : (
                        <span className="text-ink/25">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top hidden md:table-cell">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
                        {STAGE_LABELS[lead.stage as LeadStage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {lead.estimated_value != null ? (
                        <span className="font-semibold text-emerald-800">{fmt(lead.estimated_value)}</span>
                      ) : (
                        <span className="text-ink/25">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-wine/80 opacity-0 group-hover:opacity-100 sm:opacity-100 font-serif"
                        onClick={() => onEditContact(lead)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && q.trim() && (
          <p className="px-4 py-8 text-center text-sm text-ink/40 font-serif">No matches for &ldquo;{q}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
