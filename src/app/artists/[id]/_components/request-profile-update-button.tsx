'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import pathsConfig from '~/config/paths.config';
import {
  MAX_REQUEST_MESSAGE,
  REQUESTABLE_FIELDS,
  REQUESTABLE_FIELD_LABELS,
  type RequestableField,
} from '~/lib/artist-profile-content/fields';
import { requestArtistProfileUpdate } from '../_actions/profile-update-requests';

/**
 * "Request an update" on a claimed artist's profile: a gallery, collector or
 * curator asks the artist to add or refresh their CV, statement, exhibition
 * history, bio or header image.
 */
export function RequestProfileUpdateButton({
  artistAccountId,
  profileId,
  artistName,
  signedIn,
  returnPath,
  openRequest,
  missing = [],
}: {
  artistAccountId: string;
  /** The artist profile shown on the page, when the account has one */
  profileId: string | null;
  artistName: string;
  signedIn: boolean;
  /** Where to come back to after signing in */
  returnPath: string;
  /** The viewer's open request to this artist, if any */
  openRequest: { fields: RequestableField[]; message: string | null } | null;
  /** Fields the profile has nothing for yet; pre-ticked */
  missing?: RequestableField[];
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Set<RequestableField>>(
    () => new Set(openRequest?.fields ?? missing),
  );
  const [message, setMessage] = useState(openRequest?.message ?? '');
  const [hasOpen, setHasOpen] = useState(Boolean(openRequest));
  const [isPending, startTransition] = useTransition();

  const triggerClass =
    'inline-flex items-center gap-1.5 rounded-full border border-wine/20 bg-wine/5 px-3 py-1.5 text-xs font-serif text-wine hover:bg-wine/10 transition-colors';

  if (!signedIn) {
    return (
      <Link href={`${pathsConfig.auth.signIn}?next=${encodeURIComponent(returnPath)}`} className={triggerClass}>
        <MessageSquarePlus className="h-3 w-3" />
        Request an update
      </Link>
    );
  }

  const toggle = (field: RequestableField, on: boolean) => {
    setFields((prev) => {
      const next = new Set(prev);
      if (on) next.add(field);
      else next.delete(field);
      return next;
    });
  };

  const send = () => {
    startTransition(async () => {
      const result = await requestArtistProfileUpdate({ artistAccountId, profileId, fields: [...fields], message });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.updated ? 'Request updated' : `Request sent to ${artistName}`);
      setHasOpen(true);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClass} data-testid="request-profile-update">
          <MessageSquarePlus className="h-3 w-3" />
          {hasOpen ? 'Update requested' : 'Request an update'}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Ask {artistName} to update their profile</DialogTitle>
          <DialogDescription className="font-serif">
            {hasOpen
              ? 'You already asked. Change what you need and send again to update your request.'
              : 'They get a notification and an email, and can mark it done or dismiss it.'}
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-2 font-serif text-sm text-ink/70">What would you like them to add or update?</legend>
          {REQUESTABLE_FIELDS.map((field) => (
            <label key={field} className="flex cursor-pointer items-center gap-2 font-serif text-sm">
              <Checkbox checked={fields.has(field)} onCheckedChange={(v) => toggle(field, v === true)} />
              {REQUESTABLE_FIELD_LABELS[field]}
            </label>
          ))}
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="profile-update-message">Note (optional)</Label>
          <Textarea
            id="profile-update-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_REQUEST_MESSAGE}
            placeholder="e.g. We're preparing a catalogue for your show in March"
            className="font-serif"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={send}
            disabled={isPending || fields.size === 0}
            className="bg-wine text-parchment hover:bg-wine/90"
          >
            {isPending ? 'Sending…' : hasOpen ? 'Update request' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
