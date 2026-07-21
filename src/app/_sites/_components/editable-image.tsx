'use client';

/**
 * EditableImage
 *
 * Wraps any image (hero, logo, etc.) with an overlay replace button in edit mode.
 * Clicking it posts a REQUEST_IMAGE_UPLOAD message up to the parent editor,
 * which then triggers its existing upload flow and sends back the new URL via
 * IMAGE_UPLOADED.
 *
 * On public sites, renders nothing extra.
 */

import { useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { useSiteEdit } from './site-edit-context';

type Props = {
  /** 'hero' or 'logo' — used to route the upload request */
  field: 'hero' | 'logo';
  children: ReactNode;
  /** Label shown on the overlay button */
  label?: string;
};

export function EditableImage({ field, children, label = 'Replace image' }: Props) {
  const { isEditMode, postUp } = useSiteEdit();
  const [hovered, setHovered] = useState(false);

  if (!isEditMode) {
    return <>{children}</>;
  }

  function requestUpload() {
    console.log('[SiteEdit] EditableImage requestUpload', { field });
    postUp({ type: 'REQUEST_IMAGE_UPLOAD', payload: { field } });
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}

      {hovered && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.45)',
            transition: 'opacity 0.15s ease',
            cursor: 'pointer',
          }}
          onClick={requestUpload}
        >
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'rgba(255,255,255,0.92)',
              color: '#222',
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <Upload size={14} />
            {label}
          </button>
        </div>
      )}
    </div>
  );
}
