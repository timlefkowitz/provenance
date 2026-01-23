'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { Label } from '@kit/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { approveArtistProfileClaim } from '../_actions/approve-artist-profile-claim';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

type PendingClaim = {
  id: string;
  profile_id: string;
  artist_user_id: string;
  gallery_id: string;
  status: string;
  message: string | null;
  gallery_response: string | null;
  created_at: string;
  updated_at: string;
  profile: {
    id: string;
    name: string;
    medium: string | null;
  };
  artist: {
    id: string;
    name: string;
    picture_url: string | null;
  };
};

export function PendingClaimsList({
  claims,
}: {
  claims: PendingClaim[];
}) {
  const [selectedClaim, setSelectedClaim] = useState<PendingClaim | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [response, setResponse] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const pendingClaims = claims.filter(c => c.status === 'pending');
  const processedClaims = claims.filter(c => c.status !== 'pending');

  const handleApprove = () => {
    if (!selectedClaim) return;

    startTransition(async () => {
      try {
        const result = await approveArtistProfileClaim(
          selectedClaim.id,
          true,
          response || undefined
        );
        
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Claim approved! The artist profile has been linked to their account.');
          setApproveDialogOpen(false);
          setSelectedClaim(null);
          setResponse('');
          router.refresh();
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to approve claim');
      }
    });
  };

  const handleReject = () => {
    if (!selectedClaim) return;

    startTransition(async () => {
      try {
        const result = await approveArtistProfileClaim(
          selectedClaim.id,
          false,
          response || undefined
        );
        
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Claim rejected.');
          setRejectDialogOpen(false);
          setSelectedClaim(null);
          setResponse('');
          router.refresh();
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to reject claim');
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-wine" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending';
    }
  };

  if (claims.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink/60 font-serif">
          No profile claims yet
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {pendingClaims.length > 0 && (
          <div>
            <h3 className="font-display font-bold text-wine text-lg mb-4">
              Pending Claims ({pendingClaims.length})
            </h3>
            <div className="space-y-4">
              {pendingClaims.map((claim) => (
                <Card
                  key={claim.id}
                  className="border-wine/40 bg-white"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Artist Avatar */}
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-wine/20 bg-wine/10 flex-shrink-0">
                        {claim.artist.picture_url ? (
                          <Image
                            src={claim.artist.picture_url}
                            alt={claim.artist.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xl font-display font-bold text-wine uppercase">
                              {claim.artist.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Claim Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h4 className="font-display font-bold text-wine text-lg">
                              {claim.profile.name}
                            </h4>
                            <p className="text-ink/70 font-serif text-sm">
                              Claimed by <strong>{claim.artist.name}</strong>
                            </p>
                            {claim.profile.medium && (
                              <p className="text-ink/60 font-serif text-sm italic mt-1">
                                {claim.profile.medium}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-ink/60">
                            {getStatusIcon(claim.status)}
                            <span className="font-serif">{getStatusText(claim.status)}</span>
                          </div>
                        </div>

                        {claim.message && (
                          <div className="mt-3 p-3 bg-wine/5 rounded-md border border-wine/10">
                            <p className="text-xs text-ink/60 font-serif mb-1">Artist's message:</p>
                            <p className="text-sm text-ink/80 font-serif">{claim.message}</p>
                          </div>
                        )}

                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setApproveDialogOpen(true);
                            }}
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setRejectDialogOpen(true);
                            }}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {processedClaims.length > 0 && (
          <div>
            <h3 className="font-display font-bold text-wine text-lg mb-4">
              Processed Claims ({processedClaims.length})
            </h3>
            <div className="space-y-4">
              {processedClaims.map((claim) => (
                <Card
                  key={claim.id}
                  className="border-wine/20 bg-parchment/30"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-wine/20 bg-wine/10 flex-shrink-0">
                        {claim.artist.picture_url ? (
                          <Image
                            src={claim.artist.picture_url}
                            alt={claim.artist.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-lg font-display font-bold text-wine uppercase">
                              {claim.artist.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-display font-semibold text-wine">
                              {claim.profile.name}
                            </h4>
                            <p className="text-ink/60 font-serif text-sm">
                              {claim.artist.name} • {new Date(claim.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {getStatusIcon(claim.status)}
                            <span className="font-serif text-ink/60">{getStatusText(claim.status)}</span>
                          </div>
                        </div>

                        {claim.gallery_response && (
                          <div className="mt-2 p-2 bg-white/50 rounded border border-wine/10">
                            <p className="text-xs text-ink/60 font-serif mb-1">Your response:</p>
                            <p className="text-sm text-ink/70 font-serif">{claim.gallery_response}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="font-serif">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              Approve Profile Claim
            </DialogTitle>
            <DialogDescription>
              Approve {selectedClaim?.artist.name}'s claim for the profile "{selectedClaim?.profile.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-response" className="text-ink">
                Optional Response (to the artist)
              </Label>
              <Textarea
                id="approve-response"
                placeholder="Optional message to the artist..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={3}
                className="font-serif"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApproveDialogOpen(false);
                setResponse('');
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={pending}
              className="bg-green-600 hover:bg-green-700"
            >
              {pending ? 'Approving...' : 'Approve Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="font-serif">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              Reject Profile Claim
            </DialogTitle>
            <DialogDescription>
              Reject {selectedClaim?.artist.name}'s claim for the profile "{selectedClaim?.profile.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-response" className="text-ink">
                Reason (optional)
              </Label>
              <Textarea
                id="reject-response"
                placeholder="Optional reason for rejection..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={3}
                className="font-serif"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setResponse('');
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={pending}
              variant="destructive"
            >
              {pending ? 'Rejecting...' : 'Reject Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

