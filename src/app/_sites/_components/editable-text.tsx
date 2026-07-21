'use client';

/**
 * EditableText
 *
 * Renders a text value inline. In edit mode:
 *  - Hover shows a dashed underline affordance
 *  - Click converts to contentEditable
 *  - Blur / Enter commits and posts the change to the parent editor
 *
 * Falls back to rendering children (or `value`) unchanged on public sites.
 */

import React, {
  useRef,
  useEffect,
  useState,
  type CSSProperties,
  type ElementType,
} from 'react';
import { useSiteEdit } from './site-edit-context';
import type { EditableTextField } from './site-edit-context';

type Props = {
  /** The field key used to route the update back to the editor */
  field: EditableTextField;
  /** Current value to display */
  value: string | null | undefined;
  /** Placeholder shown when value is empty in edit mode */
  placeholder?: string;
  /** Tag to render as (span, p, h1, etc.) — default "span" */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

export function EditableText({
  field,
  value,
  placeholder = 'Click to edit…',
  as: Tag = 'span',
  className,
  style,
}: Props) {
  const { isEditMode, postUp } = useSiteEdit();
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);

  // Keep contentEditable in sync when value changes externally (from bridge)
  useEffect(() => {
    if (editing || !ref.current) return;
    if (ref.current.textContent !== (value ?? '')) {
      ref.current.textContent = value ?? '';
    }
  }, [value, editing]);

  if (!isEditMode) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  const isEmpty = !value;

  function startEdit() {
    setEditing(true);
    // Move caret to end
    const el = ref.current;
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function commit() {
    setEditing(false);
    const newValue = ref.current?.textContent?.trim() ?? '';
    console.log('[SiteEdit] EditableText commit', { field, newValue });
    postUp({ type: 'EDIT_TEXT', payload: { field, value: newValue } });
  }

  const editStyle: CSSProperties = {
    ...style,
    cursor: editing ? 'text' : 'pointer',
    outline: editing ? '2px dashed rgba(74,47,37,0.5)' : 'none',
    outlineOffset: '2px',
    borderRadius: '2px',
    textDecoration: !editing ? 'underline dashed rgba(74,47,37,0.4) 1px' : 'none',
    textUnderlineOffset: '3px',
    minWidth: '2em',
    transition: 'outline-color 0.15s ease',
    ...(isEmpty && !editing ? { opacity: 0.4 } : {}),
  };

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      contentEditable={editing}
      suppressContentEditableWarning
      className={className}
      style={editStyle}
      title={editing ? undefined : 'Click to edit'}
      onClick={!editing ? startEdit : undefined}
      onBlur={editing ? commit : undefined}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!editing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          // Restore original value and exit
          if (ref.current) ref.current.textContent = value ?? '';
          setEditing(false);
        }
      }}
    >
      {isEmpty && !editing ? placeholder : value}
    </Tag>
  );
}
