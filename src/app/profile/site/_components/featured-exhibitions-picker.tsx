'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Switch } from '@kit/ui/switch';
import { Label } from '@kit/ui/label';
import {
  getEligibleSiteExhibitionsAction,
  type EligibleSiteExhibition,
} from '../_actions/get-eligible-site-exhibitions';

type Props = {
  profileId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function FeaturedExhibitionsPicker({ profileId, selectedIds, onChange }: Props) {
  const [curated, setCurated] = useState(selectedIds.length > 0);
  const [eligible, setEligible] = useState<EligibleSiteExhibition[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    if (!curated || loaded) return;
    startLoad(async () => {
      const rows = await getEligibleSiteExhibitionsAction(profileId);
      setEligible(rows);
      setLoaded(true);
    });
  }, [curated, loaded, profileId]);

  function handleToggleCurated(v: boolean) {
    setCurated(v);
    if (!v) onChange([]);
  }

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function moveUp(id: string) {
    const idx = selectedIds.indexOf(id);
    if (idx <= 0) return;
    const next = [...selectedIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveDown(id: string) {
    const idx = selectedIds.indexOf(id);
    if (idx < 0 || idx >= selectedIds.length - 1) return;
    const next = [...selectedIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  function removeFromSelected(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function formatDateRange(start: string, end: string | null) {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return end ? `${fmt(start)} – ${fmt(end)}` : `From ${fmt(start)}`;
  }

  const selectedExhibitions = selectedIds
    .map((id) => eligible.find((e) => e.id === id))
    .filter(Boolean) as EligibleSiteExhibition[];
  const unselectedExhibitions = eligible.filter((e) => !selectedIds.includes(e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-serif text-sm text-ink/80">Curate exhibitions</Label>
          <p className="text-[11px] text-ink/45 font-serif mt-0.5">
            {curated
              ? 'Hand-pick which exhibitions appear and in what order.'
              : 'Showing your latest published exhibitions automatically.'}
          </p>
        </div>
        <Switch checked={curated} onCheckedChange={handleToggleCurated} />
      </div>

      {curated && (
        <div className="space-y-4">
          {/* Selected (ordered) */}
          {selectedExhibitions.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-ink/40 font-serif mb-2">
                Featured ({selectedExhibitions.length})
              </p>
              <ul className="space-y-1.5">
                {selectedExhibitions.map((ex, idx) => (
                  <li
                    key={ex.id}
                    className="flex items-center gap-2 rounded-lg border border-wine/15 bg-wine/3 px-2 py-1.5"
                  >
                    {ex.image_url ? (
                      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                        <Image src={ex.image_url} alt={ex.title} fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-wine/10 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-serif text-ink truncate">{ex.title}</span>
                      {ex.location && (
                        <span className="block text-[10px] text-ink/40 font-serif truncate">{ex.location}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => moveUp(ex.id)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-wine/10 disabled:opacity-30 transition-colors"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-ink/60" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(ex.id)}
                        disabled={idx === selectedExhibitions.length - 1}
                        className="p-0.5 rounded hover:bg-wine/10 disabled:opacity-30 transition-colors"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-ink/60" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromSelected(ex.id)}
                        className="p-0.5 rounded hover:bg-wine/10 transition-colors"
                        aria-label="Remove"
                      >
                        <X className="w-3.5 h-3.5 text-ink/60" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loading && (
            <p className="text-xs font-serif text-ink/40 text-center py-4">Loading exhibitions…</p>
          )}

          {!loading && loaded && eligible.length === 0 && (
            <p className="text-xs font-serif text-ink/40 text-center py-4">
              No published exhibitions found. Publish an exhibition first.
            </p>
          )}

          {!loading && unselectedExhibitions.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-ink/40 font-serif mb-2">
                All exhibitions — tap to add
              </p>
              <ul className="space-y-1">
                {unselectedExhibitions.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(ex.id)}
                      className="w-full flex items-center gap-2 rounded-lg border border-wine/10 px-2 py-1.5 hover:border-wine/30 hover:bg-wine/[0.02] transition-all text-left"
                    >
                      {ex.image_url ? (
                        <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                          <Image src={ex.image_url} alt={ex.title} fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-wine/10 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-serif text-ink truncate">{ex.title}</span>
                        <span className="block text-[10px] text-ink/40 font-serif">
                          {formatDateRange(ex.start_date, ex.end_date)}
                          {ex.location ? ` · ${ex.location}` : ''}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
