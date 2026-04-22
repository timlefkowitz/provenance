'use client';

import { useState, useCallback, useMemo } from 'react';
import { LayoutGrid, BarChart3, BookUser } from 'lucide-react';
import { LeadsKanban } from './leads-kanban';
import { CrmAnalytics } from './crm-analytics';
import { CrmContactsList } from './crm-contacts-list';
import { LEAD_STAGES, STAGE_LABELS, type ArtistLead, type LeadStage } from '../_actions/leads-constants';
import type { CrmMember, ColumnLabels } from '../_actions/crm-members';

type CrmTab = 'crm' | 'analytics' | 'contacts';

const TABS: { id: CrmTab; label: string; short: string; icon: React.ElementType }[] = [
  { id: 'crm',       label: 'CRM',       short: 'Board & pipeline', icon: LayoutGrid },
  { id: 'analytics', label: 'Analytics', short: 'Funnel & totals',  icon: BarChart3 },
  { id: 'contacts',  label: 'Contacts',  short: 'All people',       icon: BookUser },
];

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

  // Resolved stage labels (custom overrides merged with defaults) — shared across tabs
  const stageLabels = useMemo(
    () =>
      LEAD_STAGES.reduce(
        (acc, s) => ({ ...acc, [s]: (initialColumnLabels[s] as string | undefined) || STAGE_LABELS[s] }),
        {} as Record<LeadStage, string>,
      ),
    [initialColumnLabels],
  );

  const onConsumedPendingOpen = useCallback(() => setPendingOpenLeadId(null), []);

  const handleEditFromContacts = useCallback((lead: ArtistLead) => {
    setTab('crm');
    setPendingOpenLeadId(lead.id);
  }, []);

  return (
    <>
      {/* ── Tab nav ── */}
      <div className="border-b border-wine/12">
        <div className="container mx-auto px-4 max-w-7xl">
          <nav className="flex gap-1 py-1.5" role="tablist" aria-label="CRM sections">
            {TABS.map((t) => {
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
                    'group relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all text-left',
                    isActive
                      ? 'bg-wine text-parchment shadow-sm'
                      : 'text-ink/55 hover:text-ink hover:bg-wine/6',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                      isActive
                        ? 'bg-white/15 text-parchment'
                        : 'bg-wine/6 text-wine/50 group-hover:bg-wine/10 group-hover:text-wine',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif font-semibold text-sm leading-tight">{t.label}</span>
                    <span
                      className={[
                        'block text-[10px] leading-tight font-serif hidden sm:block',
                        isActive ? 'text-parchment/65' : 'text-ink/35',
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

      {/* ── Tab content ── */}
      <div className="container mx-auto px-4 max-w-7xl py-8 pb-24">
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
        {tab === 'analytics' && (
          <CrmAnalytics leads={leads} stageLabels={stageLabels} />
        )}
        {tab === 'contacts' && (
          <CrmContactsList
            leads={leads}
            stageLabels={stageLabels}
            onEditContact={handleEditFromContacts}
          />
        )}
      </div>
    </>
  );
}
