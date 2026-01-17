'use client';

import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@kit/ui/popover';

type Artist = {
  id: string;
  name: string;
  picture_url: string | null;
};

type ArtistSelectorProps = {
  selectedArtists: Artist[];
  onArtistsChange: (artists: Artist[]) => void;
  placeholder?: string;
};

export function ArtistSelector({
  selectedArtists,
  onArtistsChange,
  placeholder = 'Search for artists...',
}: ArtistSelectorProps) {
  const [search, setSearch] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setArtists([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search-artists?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out already selected artists
        const selectedIds = selectedArtists.map(a => a.id);
        setArtists(data.filter((a: Artist) => !selectedIds.includes(a.id)));
      }
    } catch (error) {
      console.error('Error searching artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddArtist = (artist: Artist) => {
    if (!selectedArtists.find(a => a.id === artist.id)) {
      onArtistsChange([...selectedArtists, artist]);
      setSearch('');
      setArtists([]);
    }
  };

  const handleRemoveArtist = (artistId: string) => {
    onArtistsChange(selectedArtists.filter(a => a.id !== artistId));
  };

  useEffect(() => {
    if (search && search.length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSearch(search);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setArtists([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-2">
      <Label>Artists</Label>
      
      {/* Selected Artists */}
      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedArtists.map((artist) => (
            <div
              key={artist.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-wine/10 border border-wine/30 rounded-md text-sm font-serif"
            >
              <span>{artist.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveArtist(artist.id)}
                className="hover:text-wine transition-colors"
                aria-label={`Remove ${artist.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink/40 z-10" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.length >= 2) {
                  setOpen(true);
                }
              }}
              onFocus={() => {
                if (search.length >= 2) {
                  setOpen(true);
                }
              }}
              placeholder={placeholder}
              className="font-serif pl-10"
            />
          </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-2">
            {loading ? (
              <p className="text-sm text-ink/60 font-serif p-4 text-center">Searching...</p>
            ) : artists.length === 0 ? (
              <p className="text-sm text-ink/60 font-serif p-4 text-center">
                {search.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No artists found'}
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {artists.map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => {
                      handleAddArtist(artist);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-wine/10 rounded-md transition-colors font-serif text-sm"
                  >
                    {artist.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
        </Popover>
      </div>
      
      <p className="text-xs text-ink/60 font-serif">
        Search and select artists participating in this exhibition
      </p>
    </div>
  );
}

