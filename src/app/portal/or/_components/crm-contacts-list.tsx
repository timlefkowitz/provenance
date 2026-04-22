'use client';

import { useMemo, useState } from 'react';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { Search, Mail, Phone, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { STAGE_STYLES, type ArtistLead, type LeadStage } from '../_actions/leads-constants';

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

type SortKey = 'name' | 'stage' | 'value';
type SortDir = 'asc' | 'desc';

const STAGE_ORDER: Record<LeadStage, number> = {
  interested: 0, contacted: 1, negotiating: 2, sold: 3,
};

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
  if (col !== active) return <ChevronsUpDown className="h-3 w-3 text-ink/20 ml-1 inline-block" />;
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-wine/70 ml-1 inline-block" />
    : <ChevronDown className="h-3 w-3 text-wine/70 ml-1 inline-block" />;
}

export function CrmContactsList({
  leads,
  stageLabels,
  onEditContact,
}: {
  leads: ArtistLead[];
  stageLabels: Record<LeadStage, string>;
  onEditContact: (lead: ArtistLead) => void;
}) {
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const rows = useMemo(() => {
    let list = [...leads];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (l) =>
          l.contact_name?.toLowerCase().includes(s) ||
          l.contact_email?.toLowerCase().includes(s) ||
          l.contact_phone?.toLowerCase().includes(s) ||
          l.notes?.toLowerCase().includes(s),
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name')  cmp = displayName(a).localeCompare(displayName(b));
      if (sortKey === 'stage') cmp = STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
      if (sortKey === 'value') cmp = (a.estimated_value ?? -1) - (b.estimated_value ?? -1);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [leads, q, sortKey, sortDir]);

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-wine/20 bg-parchment/30 px-8 py-20 text-center">
        <p className="font-display text-lg font-semibold text-ink/40 mb-1">No contacts yet</p>
        <p className="font-serif text-sm text-ink/35">Everyone you add in CRM will appear here as a contact list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/35" />
          <Input
            placeholder="Search by name, email, phone, or notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 font-serif text-sm h-10 border-wine/20 rounded-xl"
          />
        </div>
        <p className="text-xs font-serif text-ink/40 shrink-0">
          {rows.length} of {leads.length} contact{leads.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-wine/12 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-serif">
            <thead>
              <tr className="bg-parchment/60 border-b border-wine/10">
                <th className="px-5 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="text-[10px] uppercase tracking-wider text-ink/50 font-semibold hover:text-ink transition-colors flex items-center"
                  >
                    Contact <SortIcon col="name" active={sortKey} dir={sortDir} />
                  </button>
                </th>
                <th className="px-5 py-3 text-left hidden sm:table-cell">
                  <span className="text-[10px] uppercase tracking-wider text-ink/50 font-semibold">Phone</span>
                </th>
                <th className="px-5 py-3 text-left hidden md:table-cell">
                  <button
                    type="button"
                    onClick={() => toggleSort('stage')}
                    className="text-[10px] uppercase tracking-wider text-ink/50 font-semibold hover:text-ink transition-colors flex items-center"
                  >
                    Stage <SortIcon col="stage" active={sortKey} dir={sortDir} />
                  </button>
                </th>
                <th className="px-5 py-3 text-right hidden lg:table-cell">
                  <button
                    type="button"
                    onClick={() => toggleSort('value')}
                    className="text-[10px] uppercase tracking-wider text-ink/50 font-semibold hover:text-ink transition-colors flex items-center ml-auto"
                  >
                    Value <SortIcon col="value" active={sortKey} dir={sortDir} />
                  </button>
                </th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-wine/6">
              {rows.map((lead) => {
                const styles = STAGE_STYLES[lead.stage as LeadStage];
                return (
                  <tr key={lead.id} className="hover:bg-parchment/40 transition-colors group">
                    <td className="px-5 py-3.5 align-top min-w-0">
                      <p className="font-semibold text-ink text-sm leading-snug">{displayName(lead)}</p>
                      {lead.contact_email && (
                        <a
                          href={`mailto:${lead.contact_email}`}
                          className="text-[11px] text-wine/75 hover:text-wine hover:underline flex items-center gap-1 mt-0.5 break-all"
                        >
                          <Mail className="h-2.5 w-2.5 shrink-0" />
                          {lead.contact_email}
                        </a>
                      )}
                      {lead.notes && (
                        <p className="text-[11px] text-ink/40 mt-0.5 line-clamp-1">{lead.notes}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-top text-ink/55 text-xs hidden sm:table-cell">
                      {lead.contact_phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {lead.contact_phone}
                        </span>
                      ) : (
                        <span className="text-ink/20">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-top hidden md:table-cell">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${styles.badge}`}>
                        {stageLabels[lead.stage as LeadStage]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right align-top hidden lg:table-cell">
                      {lead.estimated_value != null ? (
                        <span className="text-xs font-semibold text-emerald-800 tabular-nums">{fmt(lead.estimated_value)}</span>
                      ) : (
                        <span className="text-ink/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-ink/50 hover:text-wine hover:bg-wine/6 opacity-0 group-hover:opacity-100 transition-opacity font-serif text-xs"
                        onClick={() => onEditContact(lead)}
                      >
                        <Pencil className="h-3 w-3 mr-1.5" />
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
          <div className="px-5 py-10 text-center">
            <p className="font-serif text-sm text-ink/40">No contacts match &ldquo;{q}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}
