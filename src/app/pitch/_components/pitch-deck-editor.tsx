'use client';

import { useState } from 'react';
import { type PitchDeckSlide } from '../_actions/pitch-deck-content';

type PitchDeckEditorProps = {
  slide: PitchDeckSlide;
  onSave: (updatedSlide: PitchDeckSlide) => void;
  onCancel: () => void;
};

export function PitchDeckEditor({ slide, onSave, onCancel }: PitchDeckEditorProps) {
  const [editedSlide, setEditedSlide] = useState<PitchDeckSlide>({ ...slide });

  const handleSave = () => {
    onSave(editedSlide);
  };

  const updateContent = (index: number, value: string) => {
    if (!editedSlide.content) {
      editedSlide.content = [];
    }
    const newContent = [...editedSlide.content];
    newContent[index] = value;
    setEditedSlide({ ...editedSlide, content: newContent });
  };

  const addContentLine = () => {
    if (!editedSlide.content) {
      editedSlide.content = [];
    }
    setEditedSlide({ ...editedSlide, content: [...editedSlide.content, ''] });
  };

  const removeContentLine = (index: number) => {
    if (!editedSlide.content) return;
    const newContent = editedSlide.content.filter((_, i) => i !== index);
    setEditedSlide({ ...editedSlide, content: newContent });
  };

  const updateTableRow = (rowIndex: number, field: string, value: string) => {
    if (!editedSlide.table) return;
    const newTable = [...editedSlide.table];
    newTable[rowIndex] = { ...newTable[rowIndex], [field]: value };
    setEditedSlide({ ...editedSlide, table: newTable });
  };

  const addTableRow = () => {
    if (!editedSlide.table) {
      editedSlide.table = [];
    }
    setEditedSlide({
      ...editedSlide,
      table: [
        ...editedSlide.table,
        { solution: '', artistFirst: '', immutable: '', fullLifecycle: '' },
      ],
    });
  };

  const removeTableRow = (index: number) => {
    if (!editedSlide.table) return;
    const newTable = editedSlide.table.filter((_, i) => i !== index);
    setEditedSlide({ ...editedSlide, table: newTable });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-parchment border-4 border-double border-wine p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-3xl text-wine mb-6">Edit Slide: {slide.title}</h3>

        <div className="space-y-4">
          <div>
            <label className="block font-display text-wine mb-2">Title</label>
            <input
              type="text"
              value={editedSlide.title}
              onChange={(e) => setEditedSlide({ ...editedSlide, title: e.target.value })}
              className="w-full px-4 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
            />
          </div>

          {editedSlide.subtitle !== undefined && (
            <div>
              <label className="block font-display text-wine mb-2">Subtitle</label>
              <input
                type="text"
                value={editedSlide.subtitle || ''}
                onChange={(e) => setEditedSlide({ ...editedSlide, subtitle: e.target.value })}
                className="w-full px-4 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
              />
            </div>
          )}

          {editedSlide.tagline !== undefined && (
            <div>
              <label className="block font-display text-wine mb-2">Tagline</label>
              <input
                type="text"
                value={editedSlide.tagline || ''}
                onChange={(e) => setEditedSlide({ ...editedSlide, tagline: e.target.value })}
                className="w-full px-4 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
              />
            </div>
          )}

          {editedSlide.content && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-display text-wine">Content</label>
                <button
                  onClick={addContentLine}
                  className="px-3 py-1 bg-wine text-parchment text-sm hover:bg-wine/90"
                >
                  + Add Line
                </button>
              </div>
              <div className="space-y-2">
                {editedSlide.content.map((line, idx) => (
                  <div key={idx} className="flex gap-2">
                    <textarea
                      value={line}
                      onChange={(e) => updateContent(idx, e.target.value)}
                      className="flex-1 px-4 py-2 border-2 border-wine/30 bg-parchment text-wine font-body min-h-[60px]"
                      rows={2}
                    />
                    <button
                      onClick={() => removeContentLine(idx)}
                      className="px-3 py-2 bg-red-600 text-white hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editedSlide.table && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-display text-wine">Table</label>
                <button
                  onClick={addTableRow}
                  className="px-3 py-1 bg-wine text-parchment text-sm hover:bg-wine/90"
                >
                  + Add Row
                </button>
              </div>
              <div className="space-y-2">
                {editedSlide.table.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2">
                    <input
                      type="text"
                      value={row.solution}
                      onChange={(e) => updateTableRow(idx, 'solution', e.target.value)}
                      placeholder="Solution"
                      className="px-3 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
                    />
                    <input
                      type="text"
                      value={row.artistFirst}
                      onChange={(e) => updateTableRow(idx, 'artistFirst', e.target.value)}
                      placeholder="Artist-first"
                      className="px-3 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
                    />
                    <input
                      type="text"
                      value={row.immutable}
                      onChange={(e) => updateTableRow(idx, 'immutable', e.target.value)}
                      placeholder="Immutable"
                      className="px-3 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
                    />
                    <input
                      type="text"
                      value={row.fullLifecycle}
                      onChange={(e) => updateTableRow(idx, 'fullLifecycle', e.target.value)}
                      placeholder="Full lifecycle"
                      className="px-3 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
                    />
                    <button
                      onClick={() => removeTableRow(idx)}
                      className="px-3 py-2 bg-red-600 text-white hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editedSlide.footer !== undefined && (
            <div>
              <label className="block font-display text-wine mb-2">Footer</label>
              <input
                type="text"
                value={editedSlide.footer || ''}
                onChange={(e) => setEditedSlide({ ...editedSlide, footer: e.target.value })}
                className="w-full px-4 py-2 border-2 border-wine/30 bg-parchment text-wine font-body"
              />
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-wine text-parchment hover:bg-wine/90 font-display tracking-wide uppercase"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 border-2 border-wine text-wine hover:bg-wine/10 font-display tracking-wide uppercase"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

