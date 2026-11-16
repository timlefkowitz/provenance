'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { REQUESTABLE_FIELD_LABELS } from '~/lib/artist-profile-content/fields';
import {
  respondToProfileUpdateRequest,
  type IncomingProfileUpdateRequest,
} from '~/app/artists/[id]/_actions/profile-update-requests';

function RequestCard({ request }: { request: IncomingProfileUpdateRequest }) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [done, setDone] = useState<null | 'fulfilled' | 'dismissed'>(null);
  const [isPending, startTransition] = useTransition();

  const respond = (decision: 'fulfilled' | 'dismissed') =>
    startTransition(async () => {
      const result = await respondToProfileUpdateRequest({ requestId: request.id, decision, responseMessage: reply });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDone(decision);
      toast.success(decision === 'fulfilled' ? 'Marked as done. They have been told.' : 'Request dismissed');
      router.refresh();
    });

  if (done) {
    return (
      <p className="rounded-xl border border-wine/15 px-5 py-4 font-serif text-sm text-ink/60">
        {done === 'fulfilled' ? 'Marked as done' : 'Dismissed'}: request from {request.requestedByName ?? 'someone'}.
      </p>
    );
  }

  return (
    <article className="space-y-4 rounded-xl border border-wine/20 bg-parchment/60 p-5" data-testid="profile-update-request">
      <div>
        <p className="font-serif text-sm text-ink/80">
          <Link href={`/artists/${request.requestedById}`} className="font-semibold text-wine hover:underline">
            {request.requestedByName ?? 'Someone'}
          </Link>{' '}
          asked you to add or update{request.profileName ? ` on ${request.profileName}` : ''}. Open each one to
          update it:
        </p>
        <p className="mt-1 font-serif text-xs text-ink/45">
          {new Date(request.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {request.links.map(({ field, href }) => (
          <li key={field}>
            <Link
              href={href}
              className="inline-flex rounded-full border border-wine/25 bg-wine/5 px-3 py-1 font-serif text-xs text-wine hover:bg-wine/10"
            >
              {REQUESTABLE_FIELD_LABELS[field]}
            </Link>
          </li>
        ))}
      </ul>
      {request.message && (
        <blockquote className="border-l-2 border-wine/25 pl-3 font-serif text-sm italic text-ink/70">
          {request.message}
        </blockquote>
      )}
      <Textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Reply (optional)"
        rows={2}
        maxLength={2000}
        className="font-serif text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => respond('fulfilled')}
          disabled={isPending}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs"
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Mark as done
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => respond('dismissed')}
          disabled={isPending}
          className="font-serif text-xs border-wine/30 hover:bg-wine/10"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </article>
  );
}

/** Requests from galleries, collectors and curators for the artist to update their profile. */
export function ProfileUpdateRequestsList({ requests }: { requests: IncomingProfileUpdateRequest[] }) {
  return (
    <div className="space-y-4">
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} />
      ))}
    </div>
  );
}
