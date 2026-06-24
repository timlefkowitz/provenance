/**
 * Server-safe template registry.
 *
 * This module intentionally has NO 'use client' directive so server components
 * can call isValidTemplateId() and getTemplateComponent() directly. The actual
 * template React components are client components (defined in artist-templates.tsx),
 * but importing and referencing them here is allowed — only *calling* a function
 * that lives in a 'use client' module from the server is forbidden by Next.js.
 */

import {
  ManifestoTemplate,
  DarkroomTemplate,
  ArchiveTemplate,
  KineticTemplate,
  BroadsheetTemplate,
  VoidTemplate,
  type ArtistTemplateProps,
} from './artist-templates';

export type { ArtistTemplateProps };

export type TemplateId =
  | 'manifesto'
  | 'darkroom'
  | 'archive'
  | 'kinetic'
  | 'broadsheet'
  | 'void';

export const TEMPLATE_OPTIONS = [
  { id: 'manifesto' as const, label: 'Manifesto', component: ManifestoTemplate },
  { id: 'darkroom' as const, label: 'Darkroom', component: DarkroomTemplate },
  { id: 'archive' as const, label: 'Archive', component: ArchiveTemplate },
  { id: 'kinetic' as const, label: 'Kinetic', component: KineticTemplate },
  { id: 'broadsheet' as const, label: 'Broadsheet', component: BroadsheetTemplate },
  { id: 'void' as const, label: 'Void', component: VoidTemplate },
] as const;

export const TEMPLATE_IDS = TEMPLATE_OPTIONS.map((t) => t.id);

export function isValidTemplateId(id: string | undefined): id is TemplateId {
  return TEMPLATE_IDS.includes(id as TemplateId);
}

export function getTemplateComponent(id: TemplateId) {
  return TEMPLATE_OPTIONS.find((t) => t.id === id)?.component ?? null;
}
