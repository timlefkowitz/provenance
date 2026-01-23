'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Textarea } from '@kit/ui/textarea';
import { Label } from '@kit/ui/label';
import { claimArtistProfile } from '../_actions/claim-artist-profile';
import { toast } from 'sonner';

type UnclaimedProfile = {
  id: string;
  name: string;
  medium: string | null;
  created_by_gallery_id: string | null;
  created_at: string;
  gallery: {
    id: string;
    name: string;
  } | null;
};

export function ClaimProfileDialog({
  profile,
  trigger,
}: {
  profile: UnclaimedProfile;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleClaim = () => {
    startTransition(async () => {
      try {
        const result = await claimArtistProfile(profile.id, message || undefined);
        
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Claim request submitted! The gallery will review your request.');
          setOpen(false);
          setMessage('');
          router.refresh();
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to submit claim request');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="font-serif">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            Claim Artist Profile: {profile.name}
          </DialogTitle>
          <DialogDescription>
            {profile.gallery && (
              <span className="text-ink/70">
                This profile was created by <strong>{profile.gallery.name}</strong>. 
                They will need to approve your claim.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm text-ink/80 mb-2">
              <strong>Profile Name:</strong> {profile.name}
            </p>
            {profile.medium && (
              <p className="text-sm text-ink/80 mb-2">
                <strong>Medium:</strong> {profile.medium}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message" className="text-ink">
              Optional Message (to the gallery)
            </Label>
            <Textarea
              id="message"
              placeholder="Explain why you should claim this profile..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="font-serif"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleClaim}
            disabled={pending}
            className="bg-wine hover:bg-wine/90"
          >
            {pending ? 'Submitting...' : 'Submit Claim Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

