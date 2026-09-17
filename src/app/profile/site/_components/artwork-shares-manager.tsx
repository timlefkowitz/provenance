'use client';

import { useEffect, useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import type { Tag } from '~/app/artworks/_actions/tags';
import { createArtworkShare } from '../_actions/create-artwork-share';
import { listArtworkShares, type ArtworkShare } from '../_actions/list-artwork-shares';
import { revokeArtworkShare } from '../_actions/revoke-artwork-share';

function formatTagName(tags: Tag[], tagId: string): string {
  return tags.find((t) => t.id === tagId)?.name ?? 'Untitled tag';
}

export function ArtworkSharesManager({ tags }: { tags: Tag[] }) {
  const [shares, setShares] = useState<ArtworkShare[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [creating, startCreating] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    listArtworkShares().then((rows) => {
      setShares(rows);
      setLoaded(true);
    });
  }, []);

  const effectiveTagId = selectedTagId || tags[0]?.id || '';

  function handleCreate() {
    if (!effectiveTagId) return;
    startCreating(async () => {
      const result = await createArtworkShare({
        tagId: effectiveTagId,
        recipientEmail: recipientEmail.trim() || undefined,
      });
      if (!result.success || !result.url) {
        toast.error(result.error || 'Could not create share link');
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success('Share link copied to clipboard');
      } catch {
        toast.success(result.url);
      }
      setRecipientEmail('');
      setShares(await listArtworkShares());
    });
  }

  async function handleRevoke(shareId: string) {
    setRevokingId(shareId);
    const result = await revokeArtworkShare(shareId);
    if (!result.success) {
      toast.error(result.error || 'Could not revoke link');
    } else {
      setShares(await listArtworkShares());
    }
    setRevokingId(null);
  }

  if (tags.length === 0) {
    return (
      <p className="text-xs text-ink/45 font-serif">
        Tag some artworks first, then you can share a tag&rsquo;s works with one person via a
        private link.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={effectiveTagId}
          onChange={(e) => setSelectedTagId(e.target.value)}
          className="rounded-lg border border-wine/15 bg-white px-3 py-2 text-xs font-serif text-ink"
        >
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <Input
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="Recipient email (optional, for your reference)"
          type="email"
          className="font-serif text-xs flex-1"
        />
        <Button
          type="button"
          onClick={handleCreate}
          disabled={creating || !effectiveTagId}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs"
        >
          {creating ? 'Creating…' : 'Create link'}
        </Button>
      </div>

      {loaded && shares.length > 0 && (
        <ul className="space-y-1.5">
          {shares.map((share) => {
            const isRevoked = !!share.revoked_at;
            const isExpired = !!share.expires_at && new Date(share.expires_at) < new Date();
            return (
              <li
                key={share.id}
                className="flex items-center gap-2 rounded-lg border border-wine/15 bg-wine/3 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-serif text-ink truncate">
                    {formatTagName(tags, share.tag_id)}
                    {share.recipient_email && (
                      <span className="text-ink/45"> → {share.recipient_email}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-ink/40 font-serif">
                    {share.view_count} view{share.view_count === 1 ? '' : 's'}
                    {isRevoked ? ' · Revoked' : isExpired ? ' · Expired' : ''}
                  </p>
                </div>
                {!isRevoked && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(share.id)}
                    disabled={revokingId === share.id}
                    className="p-1 rounded hover:bg-wine/10 transition-colors disabled:opacity-40"
                    aria-label="Revoke link"
                    title="Revoke link"
                  >
                    <X className="w-3.5 h-3.5 text-ink/60" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
