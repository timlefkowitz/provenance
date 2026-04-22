'use client';

import { useState, useCallback } from 'react';
import { LayoutGrid, BarChart3, BookUser } from 'lucide-react';
import { LeadsKanban } from './leads-kanban';
import { CrmAnalytics } from './crm-analytics';
import { CrmContactsList } from './crm-contacts-list';
import type { ArtistLead } from '../_actions/leads-constants';
import type { CrmMember, ColumnLabels } from '../_actions/crm-members';

type CrmTab = 'crm' | 'analytics' | 'contacts';

export function CrmWorkspace({
  initialLeads,
  artistArtworks,
  isOwner,
  initialCrmMembers,
  initialColumnLabels,
}: {
  initialLeads: ArtistLead[];
  artistArtworks: { id: string; title: string; image_url: string | null }[];
  isOwner: boolean;
  initialCrmMembers: CrmMember[];
  initialColumnLabels: ColumnLabels;
}) {
  const [leads, setLeads] = useState<ArtistLead[]>(initialLeads);
  const [tab, setTab] = useState<CrmTab>('crm');
  const [pendingOpenLeadId, setPendingOpenLeadId] = useState<string | null>(null);

  const onConsumedPendingOpen = useCallback(() => {
    setPendingOpenLeadId(null);
  }, []);

  const handleEditFromContacts = (lead: ArtistLead) => {
    setTab('crm');
    setPendingOpenLeadId(lead.id);
  };

  const tabs = [
    { id: 'crm' as const, label: 'CRM', short: 'Board & pipeline', icon: LayoutGrid },
    { id: 'analytics' as const, label: 'Analytics', short: 'Funnel & totals', icon: BarChart3 },
    { id: 'contacts' as const, label: 'Contacts', short: 'All people', icon: BookUser },
  ];

  return (
    <>
      <div className="border-b border-wine/12 bg-gradient-to-b from-parchment/50 to-parchment/20">
        <div className="container mx-auto px-4 max-w-7xl">
          <nav className="flex flex-wrap gap-1 py-2" role="tablist" aria-label="CRM sections">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTab(t.id)}
                  className={[
                    'group flex items-center gap-2.5 rounded-2xl px-4 sm:px-5 py-2.5 text-left transition-all',
                    isActive
                      ? 'bg-wine text-parchment shadow-md ring-1 ring-wine/30'
                      : 'text-ink/55 hover:text-ink hover:bg-white/60 border border-transparent hover:border-wine/10',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                      isActive ? 'bg-white/15' : 'bg-wine/5 text-wine/50 group-hover:bg-wine/10 group-hover:text-wine',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif font-semibold text-sm leading-tight">{t.label}</span>
                    <span
                      className={[
                        'block text-[10px] leading-tight font-serif',
                        isActive ? 'text-parchment/70' : 'text-ink/35',
                      ].join(' ')}
                    >
                      {t.short}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl py-8 pb-20">
        {tab === 'crm' && (
          <LeadsKanban
            leads={leads}
            setLeads={setLeads}
            pendingOpenLeadId={pendingOpenLeadId}
            onConsumedPendingOpen={onConsumedPendingOpen}
            artistArtworks={artistArtworks}
            isOwner={isOwner}
            initialCrmMembers={initialCrmMembers}
            initialColumnLabels={initialColumnLabels}
          />
        )}
        {tab === 'analytics' && <CrmAnalytics leads={leads} />}
        {tab === 'contacts' && <CrmContactsList leads={leads} onEditContact={handleEditFromContacts} />}
      </div>
    </>
  );
}
