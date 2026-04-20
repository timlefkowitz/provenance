'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { ChevronDown, Send, User, Users, Building2, Landmark } from 'lucide-react';
import type { UserRole } from '~/lib/user-roles';
import { USER_ROLES } from '~/lib/user-roles';
import { SendToArtistDialog } from './send-to-artist-dialog';
import { SendToCollectorDialog } from './send-to-collector-dialog';
import { SendToGalleryDialog } from './send-to-gallery-dialog';

type ActiveDialog = 'artist' | 'collector' | 'gallery' | 'institution' | null;

type Props = {
  selectedArtworkIds: Set<string>;
  senderRole?: UserRole | null;
};

/**
 * Shows which recipient options are relevant for the current sender role.
 *
 * Gallery / Institution: can invite an Artist (CoA claim) or Collector (CoO claim).
 * Artist: can invite a Gallery or Institution to create a CoS linked to the artist's CoA.
 * Collector: can invite an Artist to claim CoA from the CoO.
 */
function isEnabled(
  recipient: 'artist' | 'collector' | 'gallery' | 'institution',
  senderRole: UserRole | null | undefined,
): boolean {
  switch (recipient) {
    case 'artist':
      return (
        senderRole === USER_ROLES.GALLERY ||
        senderRole === USER_ROLES.INSTITUTION ||
        senderRole === USER_ROLES.COLLECTOR
      );
    case 'collector':
      return senderRole === USER_ROLES.ARTIST;
    case 'gallery':
    case 'institution':
      return senderRole === USER_ROLES.ARTIST;
    default:
      return false;
  }
}

function disabledTitle(
  recipient: 'artist' | 'collector' | 'gallery' | 'institution',
  senderRole: UserRole | null | undefined,
): string {
  switch (recipient) {
    case 'artist':
      return 'Send artist invite from gallery, institution or collector accounts';
    case 'collector':
      return 'Send collector invite from an artist account';
    case 'gallery':
    case 'institution':
      return 'Send gallery/institution invite from an artist account';
    default:
      return 'Not available for your account type';
  }
}

export function SendMenu({ selectedArtworkIds, senderRole }: Props) {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  const disabled = selectedArtworkIds.size === 0;
  const count = selectedArtworkIds.size;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-9 min-h-9 px-3 text-xs font-serif touch-manipulation sm:h-7 sm:min-h-0 sm:px-2"
            title={
              disabled
                ? 'Select artworks to send'
                : `Send options for ${count} selected ${count === 1 ? 'artwork' : 'artworks'}`
            }
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Send
            <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() => setActiveDialog('artist')}
            disabled={!isEnabled('artist', senderRole)}
            className="text-xs font-serif cursor-pointer"
            title={!isEnabled('artist', senderRole) ? disabledTitle('artist', senderRole) : undefined}
          >
            <User className="h-3.5 w-3.5 mr-2 opacity-60" />
            Artist
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => setActiveDialog('collector')}
            disabled={!isEnabled('collector', senderRole)}
            className="text-xs font-serif cursor-pointer"
            title={!isEnabled('collector', senderRole) ? disabledTitle('collector', senderRole) : undefined}
          >
            <Users className="h-3.5 w-3.5 mr-2 opacity-60" />
            Collector
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => setActiveDialog('gallery')}
            disabled={!isEnabled('gallery', senderRole)}
            className="text-xs font-serif cursor-pointer"
            title={!isEnabled('gallery', senderRole) ? disabledTitle('gallery', senderRole) : undefined}
          >
            <Building2 className="h-3.5 w-3.5 mr-2 opacity-60" />
            Gallery
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => setActiveDialog('institution')}
            disabled={!isEnabled('institution', senderRole)}
            className="text-xs font-serif cursor-pointer"
            title={!isEnabled('institution', senderRole) ? disabledTitle('institution', senderRole) : undefined}
          >
            <Landmark className="h-3.5 w-3.5 mr-2 opacity-60" />
            Institution
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SendToArtistDialog
        open={activeDialog === 'artist'}
        onOpenChange={(open) => setActiveDialog(open ? 'artist' : null)}
        selectedArtworkIds={selectedArtworkIds}
      />

      <SendToCollectorDialog
        open={activeDialog === 'collector'}
        onOpenChange={(open) => setActiveDialog(open ? 'collector' : null)}
        selectedArtworkIds={selectedArtworkIds}
      />

      <SendToGalleryDialog
        open={activeDialog === 'gallery'}
        onOpenChange={(open) => setActiveDialog(open ? 'gallery' : null)}
        selectedArtworkIds={selectedArtworkIds}
        recipientRole="gallery"
      />

      <SendToGalleryDialog
        open={activeDialog === 'institution'}
        onOpenChange={(open) => setActiveDialog(open ? 'institution' : null)}
        selectedArtworkIds={selectedArtworkIds}
        recipientRole="institution"
      />
    </>
  );
}
