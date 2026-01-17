'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@kit/ui/popover';
import { createArtistByName } from '../_actions/create-artist-by-name';

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
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setOpen(false);
    }
  };

  const handleCreateNewArtist = async () => {
    if (!search.trim() || search.length < 2) {
      return;
    }

    // Check if artist already exists in search results
    const existing = artists.find(a => 
      a.name.toLowerCase() === search.trim().toLowerCase()
    );
    if (existing) {
      handleAddArtist(existing);
      return;
    }

    setCreating(true);
    try {
      const result = await createArtistByName(search.trim());
      if (result.success && result.artist) {
        handleAddArtist(result.artist);
      } else {
        alert(result.error || 'Failed to create artist');
      }
    } catch (error) {
      console.error('Error creating artist:', error);
      alert('Failed to create artist. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveArtist = (artistId: string) => {
    onArtistsChange(selectedArtists.filter(a => a.id !== artistId));
  };

  useEffect(() => {
    if (search && search.length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSearch(search);
        setOpen(true);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setArtists([]);
      if (search.length === 0) {
        setOpen(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const showCreateOption = search.trim().length >= 2 && 
    !artists.some(a => a.name.toLowerCase() === search.trim().toLowerCase()) &&
    !selectedArtists.some(a => a.name.toLowerCase() === search.trim().toLowerCase());

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink/40 z-10 pointer-events-none" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.length >= 2) {
                  setOpen(true);
                } else if (e.target.value.length === 0) {
                  setOpen(false);
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
          </div>
        </PopoverAnchor>
        <PopoverContent 
          className="w-[400px] p-0" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          sideOffset={4}
          onInteractOutside={(e) => {
            // Don't close when clicking the input
            if (inputRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          <div className="p-2">
            {loading ? (
              <p className="text-sm text-ink/60 font-serif p-4 text-center">Searching...</p>
            ) : (
              <>
                {artists.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-1 mb-2">
                    {artists.map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => {
                          handleAddArtist(artist);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-wine/10 rounded-md transition-colors font-serif text-sm"
                      >
                        {artist.name}
                      </button>
                    ))}
                  </div>
                )}
                
                {showCreateOption && (
                  <div className="border-t border-wine/20 pt-2">
                    <button
                      type="button"
                      onClick={handleCreateNewArtist}
                      disabled={creating}
                      className="w-full text-left px-4 py-2 hover:bg-wine/10 rounded-md transition-colors font-serif text-sm flex items-center gap-2 text-wine"
                    >
                      <Plus className="h-4 w-4" />
                      {creating ? 'Creating...' : `Create new artist: "${search.trim()}"`}
                    </button>
                  </div>
                )}
                
                {!loading && artists.length === 0 && search.length >= 2 && !showCreateOption && (
                  <p className="text-sm text-ink/60 font-serif p-4 text-center">
                    No artists found
                  </p>
                )}
                
                {search.length < 2 && (
                  <p className="text-sm text-ink/60 font-serif p-4 text-center">
                    Type at least 2 characters to search
                  </p>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      <p className="text-xs text-ink/60 font-serif">
        Search and select artists participating in this exhibition, or create a new artist
      </p>
    </div>
  );
}
