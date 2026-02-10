'use client';

import { useState, useTransition } from 'react';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { submitOpenCall } from '../../_actions/submit-open-call';
import { toast } from '@kit/ui/sonner';

export function OpenCallSubmissionForm({
  openCallId,
}: {
  openCallId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    artistName: '',
    artistEmail: '',
    message: '',
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!formData.artistName.trim() || !formData.artistEmail.trim()) {
      setError('Name and email are required.');
      return;
    }

    const form = event.currentTarget;
    const formDataObj = new FormData(form);
    formDataObj.set('artistName', formData.artistName);
    formDataObj.set('artistEmail', formData.artistEmail);
    formDataObj.set('message', formData.message);

    startTransition(async () => {
      try {
        const result = await submitOpenCall(openCallId, formDataObj);
        if (result?.error) {
          setError(result.error);
          toast.error(result.error);
          return;
        }

        setSubmitted(true);
        toast.success('Submission received. Thank you!');
        form.reset();
      } catch (submitError: any) {
        const message = submitError?.message || 'Failed to submit open call.';
        setError(message);
        toast.error(message);
      }
    });
  };

  if (submitted) {
    return (
      <Alert className="border-wine/30 bg-wine/5">
        <AlertDescription className="font-serif text-ink/80">
          Thanks for applying! Your submission has been received.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="artistName">Name *</Label>
          <Input
            id="artistName"
            name="artistName"
            value={formData.artistName}
            onChange={(event) =>
              setFormData({ ...formData, artistName: event.target.value })
            }
            placeholder="Your full name"
            className="font-serif"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="artistEmail">Email *</Label>
          <Input
            id="artistEmail"
            name="artistEmail"
            type="email"
            value={formData.artistEmail}
            onChange={(event) =>
              setFormData({ ...formData, artistEmail: event.target.value })
            }
            placeholder="you@example.com"
            className="font-serif"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Artist Statement (optional)</Label>
          <Textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={(event) =>
              setFormData({ ...formData, message: event.target.value })
            }
            rows={4}
            placeholder="Tell us about your work..."
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="artworks">Artwork Uploads *</Label>
          <Input
            id="artworks"
            name="artworks"
            type="file"
            accept="image/*"
            multiple
            required
            className="font-serif"
          />
          <p className="text-xs text-ink/60 font-serif">
            Upload 1 or more images (JPEG, PNG, WebP, GIF).
          </p>
        </div>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
      >
        {pending ? 'Submitting...' : 'Submit Open Call'}
      </Button>
    </form>
  );
}
