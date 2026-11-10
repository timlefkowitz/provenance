'use client';

import { useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import type { CertificateRecipientRole } from '~/lib/email';
import { sendCertificate } from '../_actions/send-certificate';

const ROLE_OPTIONS: { value: CertificateRecipientRole; label: string; placeholder: string }[] = [
  { value: 'artist', label: 'Artist', placeholder: 'artist@example.com' },
  { value: 'collector', label: 'Collector', placeholder: 'collector@example.com' },
  { value: 'gallery', label: 'Gallery', placeholder: 'gallery@example.com' },
];

export function SendCertificateDialog({
  artworkId,
  artworkTitle,
  onIssueOwnership,
}: {
  artworkId: string;
  artworkTitle: string;
  /** When set, a collector send offers "Issue Certificate of Ownership" instead. */
  onIssueOwnership?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<CertificateRecipientRole>('collector');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const roleOption = ROLE_OPTIONS.find((o) => o.value === role) ?? ROLE_OPTIONS[1]!;

  const reset = () => {
    setEmail('');
    setName('');
    setMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      console.log('[Certificate] SendCertificateDialog submit', { artworkId, role });
      const result = await sendCertificate({
        artworkId,
        recipientRole: role,
        email,
        name: name.trim() || undefined,
        message: message.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Certificate sent to ${email.trim()}.`);
      setOpen(false);
      reset();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="font-serif text-xs sm:text-sm border-wine/40 hover:bg-wine/10 gap-1.5"
          size="sm"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Send
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md font-serif">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Send certificate</DialogTitle>
            <DialogDescription>
              Email a link to the certificate for &quot;{artworkTitle}&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label id="send-cert-role-label">Send to</Label>
            <div
              role="radiogroup"
              aria-labelledby="send-cert-role-label"
              className="grid grid-cols-3 gap-1 rounded-md border border-ink/15 p-1"
            >
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={role === option.value}
                  onClick={() => setRole(option.value)}
                  className={`rounded px-2 py-1.5 text-sm transition-colors ${
                    role === option.value
                      ? 'bg-wine text-parchment'
                      : 'text-ink/70 hover:bg-wine/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {role === 'collector' && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-ink/80">
              This only emails a link to view the certificate. It doesn&apos;t record a sale or give the
              collector a Certificate of Ownership.
              {onIssueOwnership && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onIssueOwnership();
                  }}
                  className="mt-2 block font-semibold text-wine underline underline-offset-2"
                >
                  Sold it? Issue a Certificate of Ownership instead
                </button>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="send-cert-email">{roleOption.label} email</Label>
            <Input
              id="send-cert-email"
              type="email"
              required
              autoComplete="email"
              placeholder={roleOption.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-serif"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="send-cert-name">
              {roleOption.label} name <span className="text-ink/40 font-normal">(optional)</span>
            </Label>
            <Input
              id="send-cert-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-serif"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="send-cert-message">
              Message <span className="text-ink/40 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="send-cert-message"
              rows={3}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="font-serif"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              disabled={pending || !email.trim()}
            >
              {pending ? 'Sending…' : 'Send certificate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
