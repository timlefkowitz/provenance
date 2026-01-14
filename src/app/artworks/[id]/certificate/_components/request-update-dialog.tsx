'use client';

import { useState, useTransition } from 'react';
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
import { createProvenanceUpdateRequest } from '../../_actions/create-provenance-update-request';
import type { Artwork } from './certificate-of-authenticity';

export function RequestUpdateDialog({ artwork }: { artwork: Artwork }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    title: artwork.title || '',
    description: artwork.description || '',
    artist_name: artwork.artist_name || '',
    medium: artwork.medium || '',
    dimensions: artwork.dimensions || '',
    creation_date: artwork.creation_date ? new Date(artwork.creation_date).toISOString().split('T')[0] : '',
    former_owners: artwork.former_owners || '',
    auction_history: artwork.auction_history || '',
    exhibition_history: artwork.exhibition_history || '',
    historic_context: artwork.historic_context || '',
    celebrity_notes: artwork.celebrity_notes || '',
    value: artwork.value || '',
    edition: artwork.edition || '',
    production_location: artwork.production_location || '',
    owned_by: artwork.owned_by || '',
    request_message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      try {
        // Build update fields object (only include fields that have changed)
        const updateFields: Record<string, any> = {};
        
        if (formData.title !== (artwork.title || '')) updateFields.title = formData.title;
        if (formData.description !== (artwork.description || '')) updateFields.description = formData.description;
        if (formData.artist_name !== (artwork.artist_name || '')) updateFields.artist_name = formData.artist_name;
        if (formData.medium !== (artwork.medium || '')) updateFields.medium = formData.medium;
        if (formData.dimensions !== (artwork.dimensions || '')) updateFields.dimensions = formData.dimensions;
        if (formData.creation_date && formData.creation_date !== (artwork.creation_date ? new Date(artwork.creation_date).toISOString().split('T')[0] : '')) {
          updateFields.creation_date = formData.creation_date;
        }
        if (formData.former_owners !== (artwork.former_owners || '')) updateFields.former_owners = formData.former_owners;
        if (formData.auction_history !== (artwork.auction_history || '')) updateFields.auction_history = formData.auction_history;
        if (formData.exhibition_history !== (artwork.exhibition_history || '')) updateFields.exhibition_history = formData.exhibition_history;
        if (formData.historic_context !== (artwork.historic_context || '')) updateFields.historic_context = formData.historic_context;
        if (formData.celebrity_notes !== (artwork.celebrity_notes || '')) updateFields.celebrity_notes = formData.celebrity_notes;
        if (formData.value !== (artwork.value || '')) updateFields.value = formData.value;
        if (formData.edition !== (artwork.edition || '')) updateFields.edition = formData.edition;
        if (formData.production_location !== (artwork.production_location || '')) updateFields.production_location = formData.production_location;
        if (formData.owned_by !== (artwork.owned_by || '')) updateFields.owned_by = formData.owned_by;

        if (Object.keys(updateFields).length === 0) {
          toast.error('Please make at least one change to request an update');
          return;
        }

        const result = await createProvenanceUpdateRequest(
          artwork.id,
          updateFields,
          formData.request_message || undefined,
        );

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success('Update request submitted. The certificate owner will be notified.');
          setOpen(false);
          // Reset form
          setFormData({
            ...formData,
            request_message: '',
          });
        }
      } catch (error: any) {
        console.error('Error submitting update request:', error);
        toast.error('Failed to submit update request');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="font-serif border-wine/30 hover:bg-wine/10"
        >
          Request Update
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto font-serif">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            Request Provenance Update
          </DialogTitle>
          <DialogDescription>
            Suggest updates to the provenance information for "{artwork.title}". 
            The certificate owner will review your request.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="request_message">Message (Optional)</Label>
            <Textarea
              id="request_message"
              value={formData.request_message}
              onChange={(e) => setFormData({ ...formData, request_message: e.target.value })}
              placeholder="Explain why you're requesting these updates..."
              rows={3}
              className="font-serif"
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-display text-wine font-semibold">Proposed Changes</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="artist_name">Artist Name</Label>
                <Input
                  id="artist_name"
                  value={formData.artist_name}
                  onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="medium">Medium</Label>
                <Input
                  id="medium"
                  value={formData.medium}
                  onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="dimensions">Dimensions</Label>
                <Input
                  id="dimensions"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="creation_date">Creation Date</Label>
                <Input
                  id="creation_date"
                  type="date"
                  value={formData.creation_date}
                  onChange={(e) => setFormData({ ...formData, creation_date: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="edition">Edition</Label>
                <Input
                  id="edition"
                  value={formData.edition}
                  onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="production_location">Production Location</Label>
                <Input
                  id="production_location"
                  value={formData.production_location}
                  onChange={(e) => setFormData({ ...formData, production_location: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="font-serif"
                />
              </div>
              <div>
                <Label htmlFor="owned_by">Owned By</Label>
                <Input
                  id="owned_by"
                  value={formData.owned_by}
                  onChange={(e) => setFormData({ ...formData, owned_by: e.target.value })}
                  className="font-serif"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="former_owners">Former Owners</Label>
              <Textarea
                id="former_owners"
                value={formData.former_owners}
                onChange={(e) => setFormData({ ...formData, former_owners: e.target.value })}
                rows={2}
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="auction_history">Auction History</Label>
              <Textarea
                id="auction_history"
                value={formData.auction_history}
                onChange={(e) => setFormData({ ...formData, auction_history: e.target.value })}
                rows={2}
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="exhibition_history">Exhibition History</Label>
              <Textarea
                id="exhibition_history"
                value={formData.exhibition_history}
                onChange={(e) => setFormData({ ...formData, exhibition_history: e.target.value })}
                rows={2}
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="historic_context">Historic Context</Label>
              <Textarea
                id="historic_context"
                value={formData.historic_context}
                onChange={(e) => setFormData({ ...formData, historic_context: e.target.value })}
                rows={2}
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="celebrity_notes">Celebrity Notes</Label>
              <Textarea
                id="celebrity_notes"
                value={formData.celebrity_notes}
                onChange={(e) => setFormData({ ...formData, celebrity_notes: e.target.value })}
                rows={2}
                className="font-serif"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="font-serif"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {pending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

