'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { LogIn, Sparkles } from 'lucide-react';

export function SignInInvitationDialog({
  open,
  onOpenChange,
  artworkTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkTitle?: string;
}) {
  const router = useRouter();

  const handleSignIn = () => {
    router.push('/auth/sign-in');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md font-serif">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-wine/10 p-3">
              <Sparkles className="h-6 w-6 text-wine" />
            </div>
          </div>
          <DialogTitle className="text-center font-display text-wine text-xl">
            Sign In to View Artwork
          </DialogTitle>
          <DialogDescription className="text-center text-ink/70 pt-2">
            {artworkTitle ? (
              <>
                Sign in to view the full certificate of authenticity for{' '}
                <span className="font-semibold text-ink">{artworkTitle}</span> and
                explore more artworks in our collection.
              </>
            ) : (
              <>
                Sign in to view full certificates of authenticity and explore
                our collection of verified artworks.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-serif border-wine/30 hover:bg-wine/10 w-full sm:w-auto"
          >
            Continue Browsing
          </Button>
          <Button
            onClick={handleSignIn}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif w-full sm:w-auto"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Sign In
          </Button>
        </DialogFooter>
        <div className="text-center text-sm text-ink/60 pt-2">
          Don't have an account?{' '}
          <Link
            href="/auth/sign-up"
            className="text-wine hover:text-wine/80 underline font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Sign up
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

