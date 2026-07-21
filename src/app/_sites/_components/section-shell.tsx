'use client';

/**
 * SectionShell
 *
 * Wraps a single section in edit mode with:
 *  - A subtle accent-tinted outline on hover
 *  - A floating pill toolbar (move up / move down / toggle visibility)
 *
 * Completely invisible (just renders children) on public sites where
 * isEditMode is false.
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useSiteEdit } from './site-edit-context';
import type { SiteSectionKey } from '../types';
import { SECTION_LABELS } from '../types';

type Props = {
  sectionKey: SiteSectionKey;
  visible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  accentColor?: string;
  children: ReactNode;
};

export function SectionShell({
  sectionKey,
  visible,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  accentColor = '#4A2F25',
  children,
}: Props) {
  const { isEditMode } = useSiteEdit();
  const [hovered, setHovered] = useState(false);

  if (!isEditMode) {
    return <>{children}</>;
  }

  const label = SECTION_LABELS[sectionKey];

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        outline: hovered ? `2px solid ${accentColor}33` : '2px solid transparent',
        outlineOffset: '-2px',
        transition: 'outline-color 0.15s ease',
        opacity: visible ? 1 : 0.45,
      }}
    >
      {children}

      <AnimatePresence>
        {hovered && (
          <motion.div
            key="toolbar"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-2 right-2 z-[9990] flex items-center gap-1"
            style={{
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px',
              padding: '4px 6px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {/* Section label */}
            <span
              className="text-[10px] font-semibold uppercase tracking-widest mr-1 select-none"
              style={{ color: accentColor }}
            >
              {label}
            </span>

            <div className="w-px h-4 bg-black/10 mx-1" />

            {/* Move up */}
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Move section up"
              className="p-1 rounded hover:bg-black/5 disabled:opacity-25 transition-opacity"
              style={{ color: '#444' }}
            >
              <ChevronUp size={13} />
            </button>

            {/* Move down */}
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Move section down"
              className="p-1 rounded hover:bg-black/5 disabled:opacity-25 transition-opacity"
              style={{ color: '#444' }}
            >
              <ChevronDown size={13} />
            </button>

            <div className="w-px h-4 bg-black/10 mx-1" />

            {/* Toggle visibility */}
            <button
              type="button"
              onClick={onToggleVisibility}
              title={visible ? 'Hide section' : 'Show section'}
              className="p-1 rounded hover:bg-black/5 transition-opacity"
              style={{ color: visible ? '#444' : accentColor }}
            >
              {visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
