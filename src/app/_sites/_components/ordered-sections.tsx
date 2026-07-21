'use client';

/**
 * OrderedSections
 *
 * Renders a set of named section nodes in a data-driven order.
 * In edit mode it:
 *   - Wraps each section in SectionShell (hover toolbar)
 *   - Animates reorders via framer-motion layout animations
 *   - Posts order/visibility changes up to the parent editor
 *
 * On public sites (isEditMode = false), it renders sections in the given
 * order with zero interactive overhead.
 */

import { useMemo, useCallback } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useSiteEdit } from './site-edit-context';
import { SectionShell } from './section-shell';
import type { SiteSectionKey, SiteSections } from '../types';
import { DEFAULT_SECTION_ORDER } from '../types';

export type SectionSlots = {
  [K in SiteSectionKey]?: React.ReactNode;
};

type Props = {
  slots: SectionSlots;
  /** null = template default order */
  order: SiteSectionKey[] | null;
  sections: SiteSections;
  accentColor?: string;
};

export function OrderedSections({ slots, order, sections, accentColor }: Props) {
  const { isEditMode, overrides, postUp } = useSiteEdit();

  // Resolve the active order: respect overrides in edit mode
  const activeOrder = useMemo<SiteSectionKey[]>(() => {
    const base = (isEditMode ? (overrides.section_order ?? order) : order) ?? DEFAULT_SECTION_ORDER;
    // Ensure all keys are present (append any missing ones at the end)
    const seen = new Set(base);
    const full = [...base];
    for (const k of DEFAULT_SECTION_ORDER) {
      if (!seen.has(k)) full.push(k);
    }
    return full;
  }, [isEditMode, overrides.section_order, order]);

  // Resolve live visibility (overrides take precedence in edit mode)
  const activeSections: SiteSections = useMemo(() => {
    if (!isEditMode || !overrides.sections) return sections;
    return { ...sections, ...overrides.sections };
  }, [isEditMode, overrides.sections, sections]);

  const moveSection = useCallback(
    (key: SiteSectionKey, dir: 1 | -1) => {
      const newOrder = [...activeOrder];
      const idx = newOrder.indexOf(key);
      if (idx < 0) return;
      const target = idx + dir;
      if (target < 0 || target >= newOrder.length) return;
      [newOrder[idx], newOrder[target]] = [newOrder[target]!, newOrder[idx]!];
      postUp({ type: 'EDIT_SECTION_ORDER', payload: { order: newOrder } });
    },
    [activeOrder, postUp],
  );

  const toggleVisibility = useCallback(
    (key: SiteSectionKey) => {
      const current = activeSections[key] ?? false;
      postUp({ type: 'EDIT_SECTION_VISIBILITY', payload: { key, visible: !current } });
    },
    [activeSections, postUp],
  );

  if (!isEditMode) {
    // Plain static render for public sites
    return (
      <>
        {activeOrder.map((key) => {
          const node = slots[key];
          if (!node) return null;
          if (!activeSections[key]) return null;
          return <div key={key}>{node}</div>;
        })}
      </>
    );
  }

  return (
    <LayoutGroup>
      {activeOrder.map((key, idx) => {
        const node = slots[key];
        if (!node) return null;
        const visible = activeSections[key] ?? false;

        return (
          <motion.div
            key={key}
            layout
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <SectionShell
              sectionKey={key}
              visible={visible}
              canMoveUp={idx > 0}
              canMoveDown={idx < activeOrder.length - 1}
              onMoveUp={() => moveSection(key, -1)}
              onMoveDown={() => moveSection(key, 1)}
              onToggleVisibility={() => toggleVisibility(key)}
              accentColor={accentColor}
            >
              {node}
            </SectionShell>
          </motion.div>
        );
      })}
    </LayoutGroup>
  );
}
