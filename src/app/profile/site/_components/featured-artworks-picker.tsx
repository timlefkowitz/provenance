'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import { ChevronUp, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@kit/ui/utils';
import { Switch } from '@kit/ui/switch';
import { Label } from '@kit/ui/label';
import {
  getEligibleSiteArtworksAction,
  type EligibleSiteArtwork,
} from '../_actions/get-eligible-site-artworks';

type Props = {
  profileId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function FeaturedArtworksPicker({ profileId, selectedIds, onChange }: Props) {
  const [curated, setCurated] = useState(selectedIds.length > 0);
  const [eligible, setEligible] = useState<EligibleSiteArtwork[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    if (!curated || loaded) return;
    startLoad(async () => {
      const rows = await getEligibleSiteArtworksAction(profileId);
      setEligible(rows);
      setLoaded(true);
    });
  }, [curated, loaded, profileId]);

  function handleToggleCurated(v: boolean) {
    setCurated(v);
    if (!v) {
      onChange([]);
    }
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

  const selectedArtworks = selectedIds
    .map((id) => eligible.find((a) => a.id === id))
    .filter(Boolean) as EligibleSiteArtwork[];
  const unselectedArtworks = eligible.filter((a) => !selectedIds.includes(a.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-serif text-sm text-ink/80">Curate artworks</Label>
          <p className="text-[11px] text-ink/45 font-serif mt-0.5">
            {curated ? 'Hand-pick which works appear and in what order.' : 'Showing your latest works automatically.'}
          </p>
        </div>
        <Switch checked={curated} onCheckedChange={handleToggleCurated} />
      </div>

      {curated && (
        <div className="space-y-4">
          {/* Selected (ordered) */}
          {selectedArtworks.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-ink/40 font-serif mb-2">
                Featured ({selectedArtworks.length})
              </p>
              <ul className="space-y-1.5">
                {selectedArtworks.map((a, idx) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg border border-wine/15 bg-wine/3 px-2 py-1.5"
                  >
                    {a.image_url ? (
                      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                        <Image src={a.image_url} alt={a.title} fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-wine/10 flex-shrink-0" />
                    )}
                    <span className="flex-1 text-xs font-serif text-ink truncate">{a.title}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveUp(a.id)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-wine/10 disabled:opacity-30 transition-colors"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-ink/60" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(a.id)}
                        disabled={idx === selectedArtworks.length - 1}
                        className="p-0.5 rounded hover:bg-wine/10 disabled:opacity-30 transition-colors"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-ink/60" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromSelected(a.id)}
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

          {/* Grid of eligible artworks to pick from */}
          {loading && (
            <p className="text-xs font-serif text-ink/40 text-center py-4">Loading your artworks…</p>
          )}

          {!loading && loaded && eligible.length === 0 && (
            <p className="text-xs font-serif text-ink/40 text-center py-4">
              No verified public artworks found for this profile.
            </p>
          )}

          {!loading && unselectedArtworks.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-ink/40 font-serif mb-2">
                All works — tap to add
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {unselectedArtworks.map((a) => {
                  const isSelected = selectedIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleSelect(a.id)}
                      className={cn(
                        'relative aspect-square rounded overflow-hidden border-2 transition-all',
                        isSelected ? 'border-wine' : 'border-transparent hover:border-wine/40',
                      )}
                      title={a.title}
                    >
                      {a.image_url ? (
                        <Image src={a.image_url} alt={a.title} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full bg-wine/10 flex items-center justify-center">
                          <span className="text-[8px] text-ink/30 font-serif px-1 text-center">{a.title}</span>
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-wine/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
