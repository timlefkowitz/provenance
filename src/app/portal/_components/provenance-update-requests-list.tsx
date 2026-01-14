'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { Textarea } from '@kit/ui/textarea';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Check, X, ExternalLink } from 'lucide-react';
import { respondToProvenanceUpdateRequest } from '../../artworks/[id]/_actions/respond-to-provenance-update-request';
import type { ProvenanceUpdateRequest } from '../../artworks/[id]/_actions/get-provenance-update-requests';

export function ProvenanceUpdateRequestsList({ 
  requests 
}: { 
  requests: ProvenanceUpdateRequest[];
}) {
  const [selectedRequest, setSelectedRequest] = useState<ProvenanceUpdateRequest | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const handleRespond = (action: 'approve' | 'deny') => {
    if (!selectedRequest) return;

    startTransition(async () => {
      try {
        const result = await respondToProvenanceUpdateRequest(
          selectedRequest.id,
          action,
          reviewMessage || undefined,
        );

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Request ${action === 'approve' ? 'approved' : 'denied'} successfully`);
          setSelectedRequest(null);
          setReviewMessage('');
          window.location.reload();
        }
      } catch (error: any) {
        console.error('Error responding to request:', error);
        toast.error('Failed to respond to request');
      }
    });
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="mt-8 border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-xl text-wine">
            Provenance Update Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-4 border border-wine/20 rounded-md bg-white/50 hover:bg-white/80 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {request.artwork.image_url && (
                    <Link href={`/artworks/${request.artwork.id}/certificate`}>
                      <div className="relative w-20 h-20 rounded-md overflow-hidden border border-wine/20 flex-shrink-0">
                        <Image
                          src={request.artwork.image_url}
                          alt={request.artwork.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </Link>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <Link
                          href={`/artworks/${request.artwork.id}/certificate`}
                          className="font-display font-semibold text-wine hover:text-wine/80 transition-colors"
                        >
                          {request.artwork.title}
                        </Link>
                        <p className="text-sm text-ink/70 font-serif mt-1">
                          Requested by {request.requester.name}
                        </p>
                        <p className="text-xs text-ink/50 font-serif mt-1">
                          {new Date(request.requested_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                    {request.request_message && (
                      <p className="text-sm text-ink/80 font-serif mt-2 p-2 bg-wine/5 rounded border border-wine/10">
                        {request.request_message}
                      </p>
                    )}
                    <div className="mt-2 text-xs text-ink/60 font-serif">
                      <p className="font-semibold">Proposed changes:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {Object.keys(request.update_fields).map((key) => (
                          <li key={key}>
                            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto font-serif">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              Review Update Request
            </DialogTitle>
            <DialogDescription>
              Review the proposed changes for "{selectedRequest?.artwork.title}"
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <Label>Requested by</Label>
                <p className="text-sm font-serif text-ink">{selectedRequest.requester.name}</p>
              </div>
              {selectedRequest.request_message && (
                <div>
                  <Label>Message</Label>
                  <p className="text-sm font-serif text-ink bg-wine/5 p-3 rounded border border-wine/10">
                    {selectedRequest.request_message}
                  </p>
                </div>
              )}
              <div>
                <Label>Proposed Changes</Label>
                <div className="mt-2 space-y-3 max-h-96 overflow-y-auto">
                  {Object.entries(selectedRequest.update_fields).map(([key, value]) => (
                    <div key={key} className="p-3 bg-wine/5 rounded border border-wine/10">
                      <p className="text-xs font-semibold text-wine mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm font-serif text-ink whitespace-pre-wrap">
                        {String(value || '')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="review_message">Review Message (Optional)</Label>
                <Textarea
                  id="review_message"
                  value={reviewMessage}
                  onChange={(e) => setReviewMessage(e.target.value)}
                  placeholder="Add a message to the requester..."
                  rows={3}
                  className="font-serif"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setReviewMessage('');
              }}
              disabled={pending}
              className="font-serif"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleRespond('deny')}
              disabled={pending}
              className="font-serif"
            >
              <X className="h-4 w-4 mr-2" />
              Deny
            </Button>
            <Button
              type="button"
              onClick={() => handleRespond('approve')}
              disabled={pending}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Check className="h-4 w-4 mr-2" />
              {pending ? 'Processing...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

