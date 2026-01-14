'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { X, Search, Plus } from 'lucide-react';

type Gallery = {
  id: string;
  name: string;
  picture_url: string | null;
  location?: string | null;
};

export function GallerySelector({
  value,
  onChange,
  placeholder = 'Search for galleries or type manually...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGalleries, setSelectedGalleries] = useState<Gallery[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search galleries
  const { data: searchResults = [], isLoading } = useQuery<Gallery[]>({
    queryKey: ['search-galleries', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/search-galleries?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Parse selected galleries from the text value on mount
  useEffect(() => {
    // Try to match galleries from the text value
    // This is a best-effort approach - we'll track galleries as they're added
  }, []);

  const handleSelectGallery = (gallery: Gallery) => {
    const galleryText = gallery.location 
      ? `${gallery.name}, ${gallery.location}`
      : gallery.name;
    
    // Add to the textarea value
    const currentLines = value.split('\n').filter(line => line.trim().length > 0);
    const galleryExists = currentLines.some(line => 
      line.includes(gallery.name) || line.trim() === galleryText
    );
    
    if (!galleryExists) {
      const newValue = value.trim().length > 0 
        ? `${value.trim()}\n${galleryText}`
        : galleryText;
      onChange(newValue);
      
      // Add to selected galleries
      if (!selectedGalleries.find(g => g.id === gallery.id)) {
        setSelectedGalleries([...selectedGalleries, gallery]);
      }
    }
    
    setSearchQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveGallery = (galleryId: string) => {
    const gallery = selectedGalleries.find(g => g.id === galleryId);
    if (gallery) {
      const galleryText = gallery.location 
        ? `${gallery.name}, ${gallery.location}`
        : gallery.name;
      
      // Remove from textarea - remove lines that contain the gallery name
      const lines = value.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed !== galleryText && !trimmed.includes(gallery.name);
      });
      onChange(lines.join('\n'));
      
      // Remove from selected
      setSelectedGalleries(selectedGalleries.filter(g => g.id !== galleryId));
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink/40" />
          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(e.target.value.length >= 2);
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                setShowDropdown(true);
              }
            }}
            placeholder="Search galleries..."
            className="pl-10 font-serif"
          />
        </div>

        {/* Dropdown Results */}
        {showDropdown && searchQuery.length >= 2 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-wine/20 rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-sm text-ink/60 font-serif">Searching...</div>
            ) : searchResults.length > 0 ? (
              <div className="py-1">
                {searchResults.map((gallery) => (
                  <button
                    key={gallery.id}
                    type="button"
                    onClick={() => handleSelectGallery(gallery)}
                    className="w-full px-4 py-2 text-left hover:bg-wine/10 transition-colors flex items-center gap-3"
                  >
                    {gallery.picture_url && (
                      <img
                        src={gallery.picture_url}
                        alt={gallery.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-serif text-ink font-medium truncate">
                        {gallery.name}
                      </p>
                      {gallery.location && (
                        <p className="text-xs text-ink/60 font-serif truncate">
                          {gallery.location}
                        </p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-wine flex-shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-ink/60 font-serif">
                No galleries found. You can type manually in the text area below.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Galleries (as chips) */}
      {selectedGalleries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedGalleries.map((gallery) => (
            <div
              key={gallery.id}
              className="inline-flex items-center gap-2 px-3 py-1 bg-wine/10 border border-wine/20 rounded-full text-sm font-serif"
            >
              <span className="text-ink">{gallery.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveGallery(gallery.id)}
                className="text-wine hover:text-wine/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info Text */}
      <p className="text-xs text-ink/60 font-serif">
        Search and select galleries, or type exhibition history manually in the text area below.
      </p>
    </div>
  );
}

