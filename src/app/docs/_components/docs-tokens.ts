/** Docs shell tokens — extends admin Arch-inspired dashboard styling. */

export {
  adminShellBg as docsShellBg,
  adminSidebarClass as docsSidebarClass,
  adminMainClass as docsMainClass,
  adminPanel as docsPanel,
  adminPanelInner as docsPanelInner,
  adminMonoLabel as docsMonoLabel,
  adminLinkTile as docsLinkTile,
  adminButtonPrimary as docsButtonPrimary,
} from '~/app/admin/_components/admin-dash-tokens';

export const docsProseWidth = 'max-w-3xl';

export const docsPageHeader =
  'mb-8 border-b border-[#1793d1]/20 pb-6';

export const docsTocClass =
  'hidden xl:block w-56 shrink-0 pl-6 border-l border-[#1793d1]/15';

export const docsMethodGet =
  'inline-block rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-400';

export const docsMethodPost =
  'inline-block rounded-sm border border-[#1793d1]/40 bg-[#1793d1]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#67d4ff]';
