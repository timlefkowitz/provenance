'use client';

import { useState, useTransition } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { EditorialDialogContent } from '~/components/editorial-dialog';
import { formatPhone, phoneHref } from '~/lib/phone';

import { submitReservationRequest } from '../_actions/reservation-requests';

export function ReserveArtworkDialog({
  exhibitionId,
  artworkId,
  artworkTitle,
  contactPhone,
  defaultName,
  defaultEmail,
}: {
  exhibitionId: string;
  artworkId: string;
  artworkTitle: string;
  contactPhone?: string | null;
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: defaultName ?? '',
    email: defaultEmail ?? '',
    phone: '',
    message: '',
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitReservationRequest({ exhibitionId, artworkId, ...form });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent(true);
      toast.success('Reservation request sent');
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-serif text-xs h-8 gap-1.5 border-wine/25 hover:bg-wine/10"
          disabled={sent}
        >
          {sent ? <Check className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
          {sent ? 'Request sent' : 'Request to reserve'}
        </Button>
      </DialogTrigger>
      <EditorialDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Reserve “{artworkTitle || 'Untitled'}”</DialogTitle>
          <DialogDescription className="font-serif text-sm">
            Ask the gallery to hold this piece for you. They’ll get back to you to confirm.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="py-4 font-serif text-sm text-ink/70 space-y-2">
            <p>Your request is in. The gallery will contact you to confirm the reservation.</p>
            {contactPhone && (
              <p>
                Can’t wait? Call{' '}
                <a href={phoneHref(contactPhone)} className="text-wine underline underline-offset-4">
                  {formatPhone(contactPhone)}
                </a>
                .
              </p>
            )}
          </div>
        ) : (
          <form id={`reserve-${artworkId}`} onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`reserve-name-${artworkId}`}>Your name</Label>
              <Input
                id={`reserve-name-${artworkId}`}
                autoComplete="name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`reserve-email-${artworkId}`}>Email</Label>
              <Input
                id={`reserve-email-${artworkId}`}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`reserve-phone-${artworkId}`}>Phone</Label>
              <Input
                id={`reserve-phone-${artworkId}`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="text-[11px] text-ink/45 font-serif">Email or phone, whichever you prefer.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`reserve-message-${artworkId}`}>Message (optional)</Label>
              <Textarea
                id={`reserve-message-${artworkId}`}
                rows={3}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Anything they should know, e.g. when you can pick it up"
              />
            </div>
            {error && <p className="text-sm text-notify-error font-serif">{error}</p>}
          </form>
        )}

        <DialogFooter>
          {sent ? (
            <Button type="button" onClick={() => setOpen(false)} className="font-serif">
              Done
            </Button>
          ) : (
            <Button
              type="submit"
              form={`reserve-${artworkId}`}
              disabled={pending || !form.name.trim() || (!form.email.trim() && !form.phone.trim())}
              className="font-serif bg-wine text-parchment hover:bg-wine/90"
            >
              {pending ? 'Sending…' : 'Send request'}
            </Button>
          )}
        </DialogFooter>
      </EditorialDialogContent>
    </Dialog>
  );
}
