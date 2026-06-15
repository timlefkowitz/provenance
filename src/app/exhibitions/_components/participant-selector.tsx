'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, Mail } from 'lucide-react';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@kit/ui/popover';
import { createArtistByName } from '../_actions/create-artist-by-name';

export type ExhibitionArtist = {
  id: string;
  name: string;
  picture_url: string | null;
};

export type ExhibitionArtistInvite = {
  email: string;
  name: string;
  artistAccountId?: string | null;
  key: string;
};

type SearchResult =
  | { kind: 'artist'; id: string; name: string; picture_url: string | null }
  | { kind: 'contact'; id: string; name: string; email: string | null };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type ParticipantSelectorProps = {
  selectedArtists: ExhibitionArtist[];
  onArtistsChange: (artists: ExhibitionArtist[]) => void;
  selectedInvites: ExhibitionArtistInvite[];
  onInvitesChange: (invites: ExhibitionArtistInvite[]) => void;
  placeholder?: string;
};

export function ParticipantSelector({
  selectedArtists,
  onArtistsChange,
  selectedInvites,
  onInvitesChange,
  placeholder = 'Search artists, contacts, or enter an email…',
}: ParticipantSelectorProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedArtistIds = new Set(selectedArtists.map((a) => a.id));
  const selectedEmails = new Set(
    selectedInvites.map((i) => i.email.toLowerCase()),
  );

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const [artistsRes, contactsRes] = await Promise.all([
        fetch(`/api/search-artists?q=${encodeURIComponent(query)}`),
        fetch(`/api/search-contacts?q=${encodeURIComponent(query)}`),
      ]);

      const merged: SearchResult[] = [];

      if (artistsRes.ok) {
        const artists = (await artistsRes.json()) as ExhibitionArtist[];
        for (const artist of artists) {
          if (!selectedArtistIds.has(artist.id)) {
            merged.push({
              kind: 'artist',
              id: artist.id,
              name: artist.name,
              picture_url: artist.picture_url,
            });
          }
        }
      }

      if (contactsRes.ok) {
        const contacts = (await contactsRes.json()) as Array<{
          id: string;
          name: string;
          email: string | null;
        }>;
        for (const contact of contacts) {
          if (contact.email && selectedEmails.has(contact.email.toLowerCase())) {
            continue;
          }
          merged.push({
            kind: 'contact',
            id: contact.id,
            name: contact.name,
            email: contact.email,
          });
        }
      }

      setResults(merged.slice(0, 20));
    } catch (error) {
      console.error('[Exhibitions] ParticipantSelector search failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddArtist = (artist: ExhibitionArtist) => {
    if (!selectedArtists.find((a) => a.id === artist.id)) {
      onArtistsChange([...selectedArtists, artist]);
      setSearch('');
      setResults([]);
      setOpen(false);
    }
  };

  const handleAddInvite = (invite: Omit<ExhibitionArtistInvite, 'key'>) => {
    const email = invite.email.trim().toLowerCase();
    if (!email || selectedEmails.has(email)) {
      return;
    }
    onInvitesChange([
      ...selectedInvites,
      { ...invite, email, key: `invite-${email}` },
    ]);
    setSearch('');
    setResults([]);
    setOpen(false);
  };

  const handleCreateNewArtist = async () => {
    if (!search.trim() || search.length < 2) {
      return;
    }

    const existingArtist = results.find(
      (r) =>
        r.kind === 'artist' &&
        r.name.toLowerCase() === search.trim().toLowerCase(),
    );
    if (existingArtist && existingArtist.kind === 'artist') {
      handleAddArtist({
        id: existingArtist.id,
        name: existingArtist.name,
        picture_url: existingArtist.picture_url,
      });
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
      console.error('[Exhibitions] ParticipantSelector create artist failed', error);
      alert('Failed to create artist. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveArtist = (artistId: string) => {
    onArtistsChange(selectedArtists.filter((a) => a.id !== artistId));
  };

  const handleRemoveInvite = (key: string) => {
    onInvitesChange(selectedInvites.filter((i) => i.key !== key));
  };

  useEffect(() => {
    if (search && search.length >= 2) {
      const timeoutId = setTimeout(() => {
        void handleSearch(search);
        setOpen(true);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
    setResults([]);
    if (search.length === 0) {
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const trimmedSearch = search.trim();
  const showCreateOption =
    trimmedSearch.length >= 2 &&
    !isValidEmail(trimmedSearch) &&
    !results.some(
      (r) => r.kind === 'artist' && r.name.toLowerCase() === trimmedSearch.toLowerCase(),
    ) &&
    !selectedArtists.some(
      (a) => a.name.toLowerCase() === trimmedSearch.toLowerCase(),
    );

  const showEmailInviteOption =
    isValidEmail(trimmedSearch) && !selectedEmails.has(trimmedSearch.toLowerCase());

  return (
    <div className="space-y-2">
      <Label>Artists &amp; invites</Label>

      {(selectedArtists.length > 0 || selectedInvites.length > 0) && (
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
          {selectedInvites.map((invite) => (
            <div
              key={invite.key}
              className="flex items-center gap-2 px-3 py-1.5 bg-ink/5 border border-ink/20 rounded-md text-sm font-serif"
            >
              <Mail className="h-3.5 w-3.5 text-wine/70" />
              <span>
                {invite.name}
                <span className="text-ink/50 ml-1">({invite.email})</span>
              </span>
              <button
                type="button"
                onClick={() => handleRemoveInvite(invite.key)}
                className="hover:text-wine transition-colors"
                aria-label={`Remove invite for ${invite.email}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

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
            if (inputRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          <div className="p-2">
            {loading ? (
              <p className="text-sm text-ink/60 font-serif p-4 text-center">
                Searching…
              </p>
            ) : (
              <>
                {results.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-1 mb-2">
                    {results.map((result) => {
                      if (result.kind === 'artist') {
                        return (
                          <button
                            key={`artist-${result.id}`}
                            type="button"
                            onClick={() =>
                              handleAddArtist({
                                id: result.id,
                                name: result.name,
                                picture_url: result.picture_url,
                              })
                            }
                            className="w-full text-left px-4 py-2 hover:bg-wine/10 rounded-md transition-colors font-serif text-sm"
                          >
                            <span>{result.name}</span>
                            <span className="text-ink/45 text-xs ml-2">
                              Platform artist
                            </span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={`contact-${result.id}`}
                          type="button"
                          onClick={() => {
                            if (result.email) {
                              handleAddInvite({
                                email: result.email,
                                name: result.name,
                              });
                            }
                          }}
                          disabled={!result.email}
                          className="w-full text-left px-4 py-2 hover:bg-wine/10 rounded-md transition-colors font-serif text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span>{result.name}</span>
                          {result.email ? (
                            <span className="text-ink/45 text-xs ml-2">
                              {result.email} · Contact
                            </span>
                          ) : (
                            <span className="text-ink/45 text-xs ml-2">Contact</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {showEmailInviteOption && (
                  <div className="border-t border-wine/20 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleAddInvite({
                          email: trimmedSearch.toLowerCase(),
                          name: trimmedSearch.split('@')[0] || 'Artist',
                        })
                      }
                      className="w-full text-left px-4 py-2 hover:bg-wine/10 rounded-md transition-colors font-serif text-sm flex items-center gap-2 text-wine"
                    >
                      <Mail className="h-4 w-4" />
                      Invite {trimmedSearch.toLowerCase()}
                    </button>
                  </div>
                )}

                {showCreateOption && (
                  <div className="border-t border-wine/20 pt-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateNewArtist()}
                      disabled={creating}
                      className="w-full text-left px-4 py-2 hover:bg-wine/10 rounded-md transition-colors font-serif text-sm flex items-center gap-2 text-wine"
                    >
                      <Plus className="h-4 w-4" />
                      {creating
                        ? 'Creating…'
                        : `Create platform artist: "${trimmedSearch}"`}
                    </button>
                  </div>
                )}

                {!loading &&
                  results.length === 0 &&
                  search.length >= 2 &&
                  !showCreateOption &&
                  !showEmailInviteOption && (
                    <p className="text-sm text-ink/60 font-serif p-4 text-center">
                      No matches — try an email address to send an invite
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
        Add registered artists, pick from your contacts, or enter an email to
        send an artwork submission invite. Invited artists receive a link to
        submit work and receive a Certificate of Authenticity.
      </p>
    </div>
  );
}
