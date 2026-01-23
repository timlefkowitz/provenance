'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
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
import { useUser } from '@kit/supabase/hooks/use-user';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { editArtwork } from '../_actions/edit-artwork';
import type { Artwork } from './certificate-of-authenticity';
import Image from 'next/image';
import { X, Upload } from 'lucide-react';

type Exhibition = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

export function EditArtworkDialog({ 
  artwork, 
  isCreator,
  exhibition,
  creatorInfo
}: { 
  artwork: Artwork;
  isCreator: boolean;
  exhibition?: { 
    id: string; 
    title: string; 
    start_date: string; 
    end_date: string | null; 
    location: string | null;
    gallery?: { id: string; name: string; profileId?: string; slug?: string } | null;
  } | null;
  creatorInfo?: { name: string; role: string | null; profileId?: string; slug?: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const user = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(artwork.image_url || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: artwork.title || '',
    artist_name: artwork.artist_name || '',
    created_at: artwork.created_at ? new Date(artwork.created_at).toISOString().split('T')[0] : '',
    exhibitionId: exhibition?.id || '',
    exhibitionTitle: exhibition?.title || '',
    exhibitionStartDate: exhibition?.start_date ? new Date(exhibition.start_date).toISOString().split('T')[0] : '',
    exhibitionEndDate: exhibition?.end_date ? new Date(exhibition.end_date).toISOString().split('T')[0] : '',
    exhibitionLocation: exhibition?.location || '',
    exhibitionGalleryId: exhibition?.gallery?.id || '',
    request_message: '',
  });

  // Check if user owns the current exhibition
  const [userOwnsExhibition, setUserOwnsExhibition] = useState(false);
  
  useEffect(() => {
    async function checkExhibitionOwnership() {
      if (!exhibition?.id || !user.data?.id) {
        setUserOwnsExhibition(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/check-exhibition-ownership?exhibitionId=${exhibition.id}&userId=${user.data.id}`);
        if (response.ok) {
          const data = await response.json();
          setUserOwnsExhibition(data.owns || false);
        }
      } catch (error) {
        console.error('Error checking exhibition ownership:', error);
        setUserOwnsExhibition(false);
      }
    }
    
    if (open && exhibition) {
      checkExhibitionOwnership();
    }
  }, [exhibition?.id, user.data?.id, open]);

  // Fetch user's exhibitions if they're a gallery
  const { data: exhibitions = [] } = useQuery<Exhibition[]>({
    queryKey: ['user-exhibitions', user.data?.id],
    queryFn: async () => {
      if (!user.data?.id) return [];
      const response = await fetch(`/api/get-user-exhibitions?userId=${encodeURIComponent(user.data.id)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user.data?.id && open,
  });

  // Search galleries for exhibition gallery selection
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const { data: gallerySearchResults = [] } = useQuery<Array<{ id: string; name: string; picture_url: string | null }>>({
    queryKey: ['search-galleries', gallerySearchQuery],
    queryFn: async () => {
      if (!gallerySearchQuery || gallerySearchQuery.length < 2) return [];
      const response = await fetch(`/api/search-galleries?q=${encodeURIComponent(gallerySearchQuery)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: gallerySearchQuery.length >= 2 && open && userOwnsExhibition,
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(artwork.image_url || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('title', formData.title);
        formDataToSend.append('artist_name', formData.artist_name);
        formDataToSend.append('created_at', formData.created_at);
        formDataToSend.append('exhibitionId', formData.exhibitionId || '__none__');
        
        // Exhibition details (if user owns the exhibition)
        if (userOwnsExhibition && exhibition) {
          formDataToSend.append('exhibitionTitle', formData.exhibitionTitle);
          formDataToSend.append('exhibitionStartDate', formData.exhibitionStartDate);
          formDataToSend.append('exhibitionEndDate', formData.exhibitionEndDate || '');
          formDataToSend.append('exhibitionLocation', formData.exhibitionLocation || '');
          if (formData.exhibitionGalleryId) {
            formDataToSend.append('exhibitionGalleryId', formData.exhibitionGalleryId);
          }
        }
        
        if (imageFile) {
          formDataToSend.append('image', imageFile);
        }

        if (!isCreator) {
          formDataToSend.append('request_message', formData.request_message);
        }

        const result = await editArtwork(artwork.id, formDataToSend, isCreator);

        if (result.error) {
          toast.error(result.error);
        } else {
          if (isCreator) {
            toast.success('Artwork updated successfully');
          } else {
            toast.success('Edit request submitted. The creator will review your request.');
          }
          setOpen(false);
          // Reset form
          setFormData({
            title: artwork.title || '',
            artist_name: artwork.artist_name || '',
            created_at: artwork.created_at ? new Date(artwork.created_at).toISOString().split('T')[0] : '',
            exhibitionId: exhibition?.id || '',
            exhibitionTitle: exhibition?.title || '',
            exhibitionStartDate: exhibition?.start_date ? new Date(exhibition.start_date).toISOString().split('T')[0] : '',
            exhibitionEndDate: exhibition?.end_date ? new Date(exhibition.end_date).toISOString().split('T')[0] : '',
            exhibitionLocation: exhibition?.location || '',
            exhibitionGalleryId: exhibition?.gallery?.id || '',
            request_message: '',
          });
          setImageFile(null);
          setImagePreview(artwork.image_url || null);
          setGallerySearchQuery('');
          // Refresh the page to show updated data
          window.location.reload();
        }
      } catch (error: any) {
        console.error('Error submitting edit:', error);
        toast.error('Failed to submit edit request');
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
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto font-serif">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            {isCreator ? 'Edit Artwork' : 'Request Edit'}
          </DialogTitle>
          <DialogDescription>
            {isCreator 
              ? `Edit the information for "${artwork.title}". Changes will be applied immediately.`
              : `Request edits to "${artwork.title}". The creator will review your request.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isCreator && (
            <div>
              <Label htmlFor="request_message">Message (Optional)</Label>
              <Textarea
                id="request_message"
                value={formData.request_message}
                onChange={(e) => setFormData({ ...formData, request_message: e.target.value })}
                placeholder="Explain why you're requesting these edits..."
                rows={3}
                className="font-serif"
              />
            </div>
          )}

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-display text-wine font-semibold">
              {isCreator ? 'Edit Fields' : 'Proposed Changes'}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="font-serif"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <div className="space-y-2">
                {imagePreview && (
                  <div className="relative w-full max-w-md border-2 border-wine/20 rounded-lg p-2">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={400}
                      height={300}
                      className="w-full h-auto object-contain max-h-64"
                      unoptimized
                    />
                    {imageFile && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={removeImage}
                        className="absolute top-2 right-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-serif border-wine/30 hover:bg-wine/10"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="artist_name">Artist</Label>
              <Input
                id="artist_name"
                value={formData.artist_name}
                onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                className="font-serif"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="created_at">Date Certified</Label>
              <Input
                id="created_at"
                type="date"
                value={formData.created_at}
                onChange={(e) => setFormData({ ...formData, created_at: e.target.value })}
                className="font-serif"
              />
            </div>

            {exhibition && (
              <div className="space-y-4 border border-wine/20 rounded-lg p-4">
                <h4 className="font-display text-wine font-semibold text-sm">Exhibition Details</h4>
                
                {exhibitions.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="exhibitionId">Link to Exhibition</Label>
                    <Select
                      value={formData.exhibitionId || '__none__'}
                      onValueChange={(value) => {
                        setFormData({ ...formData, exhibitionId: value === '__none__' ? '' : value });
                      }}
                    >
                      <SelectTrigger id="exhibitionId" className="font-serif">
                        <SelectValue placeholder="Select an exhibition (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="font-serif">
                          None
                        </SelectItem>
                        {exhibitions.map((ex) => (
                          <SelectItem key={ex.id} value={ex.id} className="font-serif">
                            {ex.title}
                            {ex.start_date && (
                              <span className="text-xs text-ink/60 ml-2">
                                ({new Date(ex.start_date).getFullYear()})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {userOwnsExhibition ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="exhibitionTitle">Exhibition Title</Label>
                      <Input
                        id="exhibitionTitle"
                        value={formData.exhibitionTitle}
                        onChange={(e) => setFormData({ ...formData, exhibitionTitle: e.target.value })}
                        className="font-serif"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="exhibitionStartDate">Start Date</Label>
                        <Input
                          id="exhibitionStartDate"
                          type="date"
                          value={formData.exhibitionStartDate}
                          onChange={(e) => setFormData({ ...formData, exhibitionStartDate: e.target.value })}
                          className="font-serif"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="exhibitionEndDate">End Date</Label>
                        <Input
                          id="exhibitionEndDate"
                          type="date"
                          value={formData.exhibitionEndDate}
                          onChange={(e) => setFormData({ ...formData, exhibitionEndDate: e.target.value })}
                          className="font-serif"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="exhibitionLocation">Location</Label>
                      <Input
                        id="exhibitionLocation"
                        value={formData.exhibitionLocation}
                        onChange={(e) => setFormData({ ...formData, exhibitionLocation: e.target.value })}
                        placeholder="e.g., San Antonio, Tx"
                        className="font-serif"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="exhibitionGallery">Gallery</Label>
                      <div className="space-y-2">
                        <Input
                          id="exhibitionGallery"
                          value={gallerySearchQuery || (exhibition.gallery?.name || '')}
                          onChange={(e) => {
                            setGallerySearchQuery(e.target.value);
                            if (!e.target.value) {
                              setFormData({ ...formData, exhibitionGalleryId: '' });
                            }
                          }}
                          placeholder="Search for a gallery..."
                          className="font-serif"
                        />
                        {gallerySearchQuery.length >= 2 && gallerySearchResults.length > 0 && (
                          <div className="border border-wine/20 rounded-md bg-white shadow-lg max-h-48 overflow-y-auto">
                            {gallerySearchResults.map((gallery) => (
                              <button
                                key={gallery.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, exhibitionGalleryId: gallery.id });
                                  setGallerySearchQuery(gallery.name);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-wine/10 transition-colors flex items-center gap-3"
                              >
                                {gallery.picture_url && (
                                  <img
                                    src={gallery.picture_url}
                                    alt={gallery.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                )}
                                <span className="text-sm font-serif text-ink">{gallery.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {exhibition.gallery && !gallerySearchQuery && (
                          <p className="text-xs text-ink/60 font-serif">
                            Current: {exhibition.gallery.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-ink/80 font-serif">
                      {exhibition.title}
                      {exhibition.start_date && (
                        <span className="ml-1">
                          ({new Date(exhibition.start_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {exhibition.end_date && ` - ${new Date(exhibition.end_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}`})
                        </span>
                      )}
                      {exhibition.location && <span className="ml-1">- {exhibition.location}</span>}
                    </p>
                    {exhibition.gallery && (
                      <p className="text-sm text-ink/80 font-serif">
                        Gallery: {exhibition.gallery.name}
                      </p>
                    )}
                    <p className="text-xs text-ink/60 font-serif italic">
                      (Only the exhibition owner can edit these details)
                    </p>
                  </div>
                )}
              </div>
            )}

            {creatorInfo && (
              <div className="space-y-2">
                <Label>
                  {creatorInfo.role === 'gallery' ? 'Uploaded by Gallery' : 'Created by'}
                </Label>
                <p className="text-sm text-ink/80 font-serif">
                  {creatorInfo.name}
                  <span className="text-xs text-ink/60 ml-2 italic">
                    (cannot be changed)
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                // Reset form on cancel
                setFormData({
                  title: artwork.title || '',
                  artist_name: artwork.artist_name || '',
                  created_at: artwork.created_at ? new Date(artwork.created_at).toISOString().split('T')[0] : '',
                  exhibitionId: exhibition?.id || '',
                  exhibitionTitle: exhibition?.title || '',
                  exhibitionStartDate: exhibition?.start_date ? new Date(exhibition.start_date).toISOString().split('T')[0] : '',
                  exhibitionEndDate: exhibition?.end_date ? new Date(exhibition.end_date).toISOString().split('T')[0] : '',
                  exhibitionLocation: exhibition?.location || '',
                  exhibitionGalleryId: exhibition?.gallery?.id || '',
                  request_message: '',
                });
                setGallerySearchQuery('');
                setImageFile(null);
                setImagePreview(artwork.image_url || null);
              }}
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
              {pending 
                ? (isCreator ? 'Saving...' : 'Submitting...') 
                : (isCreator ? 'Save Changes' : 'Submit Request')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

