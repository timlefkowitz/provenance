'use client';

import { useRef, useTransition } from 'react';
import { Camera, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { extractExhibitionChecklist } from '../_actions/extract-exhibition-checklist';
import type { ChecklistArtwork, ExhibitionChecklist } from '../_helpers/checklist-parsing';
import { useAiConsent } from '~/components/ai-consent/ai-consent-provider';

export type ChecklistRow = ChecklistArtwork & { key: string };

const newKey = () => Math.random().toString(36).slice(2, 10);

/**
 * Lets the user photograph or upload an exhibition checklist, then review and
 * edit the extracted artworks before the exhibition is created.
 */
export function ChecklistImport({
  rows,
  onRowsChange,
  onExtracted,
}: {
  rows: ChecklistRow[];
  onRowsChange: (rows: ChecklistRow[]) => void;
  onExtracted: (checklist: ExhibitionChecklist) => void;
}) {
  const [scanning, startScan] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { ensureAiConsent } = useAiConsent();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!(await ensureAiConsent())) return;
    startScan(async () => {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const result = await extractExhibitionChecklist(fd);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        const { checklist } = result;
        onRowsChange(checklist.artworks.map((a) => ({ ...a, key: newKey() })));
        onExtracted(checklist);
        toast.success(
          checklist.artworks.length === 1
            ? 'Found 1 artwork. Review it below.'
            : `Found ${checklist.artworks.length} artworks. Review them below.`,
        );
      } catch (e) {
        console.error('[ChecklistImport] scan failed', e);
        toast.error('Scanning failed. Try again.');
      }
    });
  };

  const updateRow = (key: string, patch: Partial<ChecklistArtwork>) =>
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="rounded-lg border border-dashed border-wine/25 bg-parchment/60 p-4 space-y-4">
      <div>
        <p className="font-serif font-semibold text-ink">Import from a checklist</p>
        <p className="text-xs text-ink/60 font-serif">
          Snap or upload the exhibition list / price list and we&apos;ll fill in the show name,
          artists, titles, and prices. You can edit everything before saving.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={scanning}
          className="font-serif border-wine/25"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-1.5" />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={scanning}
          className="font-serif border-wine/25"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileText className="h-4 w-4 mr-1.5" />
          Upload photo or PDF
        </Button>
        {scanning && (
          <span className="flex items-center text-xs text-ink/60 font-serif">
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Reading checklist…
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[1fr_1.3fr_0.7fr_0.8fr_auto] gap-2 text-[11px] uppercase tracking-widest text-wine/50 font-serif">
            <span>Artist</span>
            <span>Artwork title</span>
            <span>Price</span>
            <span>Dimensions</span>
            <span className="w-8" />
          </div>
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-2 md:grid-cols-[1fr_1.3fr_0.7fr_0.8fr_auto] gap-2 border-b border-wine/10 pb-2 md:border-0 md:pb-0"
            >
              <Input
                aria-label="Artist name"
                value={row.artistName}
                onChange={(e) => updateRow(row.key, { artistName: e.target.value })}
                placeholder="Artist"
                className="font-serif text-sm"
              />
              <Input
                aria-label="Artwork title"
                value={row.title}
                onChange={(e) => updateRow(row.key, { title: e.target.value })}
                placeholder="Title *"
                className="font-serif text-sm"
              />
              <Input
                aria-label="Price"
                value={row.price}
                onChange={(e) => updateRow(row.key, { price: e.target.value })}
                placeholder="Price"
                className="font-serif text-sm"
              />
              <Input
                aria-label="Dimensions"
                value={row.dimensions}
                onChange={(e) => updateRow(row.key, { dimensions: e.target.value })}
                placeholder="Dimensions"
                className="font-serif text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove artwork"
                className="justify-self-end"
                onClick={() => onRowsChange(rows.filter((r) => r.key !== row.key))}
              >
                <Trash2 className="h-4 w-4 text-ink/50" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="font-serif text-wine"
              onClick={() =>
                onRowsChange([
                  ...rows,
                  { key: newKey(), artistName: '', title: '', price: '', dimensions: '' },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add row
            </Button>
            <p className="text-xs text-ink/55 font-serif">
              These will be added as draft artworks when you create the exhibition.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
