'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { useCurrentUser } from '~/hooks/use-current-user';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { editArtwork } from '../_actions/edit-artwork';
import type { Artwork } from './certificate-of-authenticity';
import Image from 'next/image';
import { X, Upload, ArrowRight } from 'lucide-react';
import { cn } from '@kit/ui/utils';
import { sendArtistClaimInvite } from '../_actions/send-artist-claim-invite';
import { CERTIFICATE_TYPES, type CertificateType } from '~/lib/user-roles';
import { ArtworkTagPicker } from '~/app/artworks/_components/artwork-tag-picker';
import { getArtworkTags, setArtworkTags, type Tag } from '~/app/artworks/_actions/tags';
import {
  isLikelyImageFile,
  prepareImageForUpload,
  MAX_UPLOAD_IMAGE_BYTES,
} from '~/lib/client-image-upload';
import {
  FIELD_LABEL,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FIELD_HINT,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FieldSection,
} from '~/components/editorial-form';

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
  creatorInfo,
  certificateType,
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
  creatorInfo?: { name: string; role: string | null; profileId?: string; slug?: string; accountId?: string } | null;
  certificateType?: CertificateType | string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const user = useCurrentUser();
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
  const [artistInviteEmail, setArtistInviteEmail] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!open || !isCreator) return;
    getArtworkTags(artwork.id).then(setSelectedTags);
  }, [open, isCreator, artwork.id]);

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    console.log('[Certificates] EditArtworkDialog image selected', {
      name: rawFile.name,
      size: rawFile.size,
      type: rawFile.type,
    });

    // iPhone photo-library picks often have an empty type or image/heic,
    // so don't rely solely on file.type.
    if (!isLikelyImageFile(rawFile)) {
      toast.error('Please select an image file');
      return;
    }

    // iPhone photos are often HEIC and/or over Vercel's ~4.5MB server action
    // body limit; convert and compress in the browser before sending.
    const file = await prepareImageForUpload(rawFile);
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      console.warn('[Certificates] EditArtworkDialog image too large after compression', {
        name: file.name,
        size: file.size,
      });
      toast.error('Photo is too large to upload. Please choose an image under 4 MB.');
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
            const tagsResult = await setArtworkTags(artwork.id, selectedTags.map((t) => t.id));
            if (!tagsResult.success) {
              toast.error(tagsResult.error || 'Artwork saved, but tags could not be updated');
            }
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
      } catch (error) {
        console.error('Error submitting edit:', error);
        toast.error('Failed to submit edit request');
      }
    });
  };

  const canInviteArtistFromThisCertificate =
    certificateType === CERTIFICATE_TYPES.SHOW || certificateType === CERTIFICATE_TYPES.OWNERSHIP;

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
      <DialogContent
        hideCloseButton
        // Don't auto-focus the first field: on iOS that raises the keyboard
        // the moment the sheet opens and shoves the layout around.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          // Phone: bottom sheet above the app chrome. sm+: centred card.
          'max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none sm:max-w-2xl',
          'max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=open]:zoom-in-100',
          'flex flex-col gap-0 p-0 overflow-hidden rounded-none sm:rounded-none',
          'max-h-[calc(100dvh-2.5rem)] sm:max-h-[88dvh]',
          'bg-bone text-editorial-ink border-0 border-t border-editorial-border sm:border shadow-editorial font-serif',
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {/* Header — pinned, owns the close button so it can never scroll away */}
        <div className="shrink-0 px-5 pt-3 pb-4 sm:px-7 sm:pt-6 border-b border-editorial-border/15">
          <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-editorial-ink/15 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={FIELD_LABEL}>
                Certificate <span className="text-vermillion">/</span>{' '}
                {isCreator ? 'Edit' : 'Edit request'}
              </p>
              <DialogTitle className="mt-2 font-fraunces italic font-normal text-[1.75rem] leading-none tracking-tight text-editorial-ink">
                {isCreator ? 'Edit artwork' : 'Request edit'}
                <span className="text-vermillion">.</span>
              </DialogTitle>
            </div>
            <DialogClose
              className="shrink-0 grid h-9 w-9 place-items-center border border-editorial-border/25 text-editorial-ink/70 transition-colors hover:border-editorial-border hover:text-editorial-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion/30"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <DialogDescription className="mt-3 font-serif text-sm leading-snug text-editorial-ink/60">
            {isCreator ? (
              <>Changes to <span className="text-editorial-ink">“{artwork.title}”</span> apply immediately.</>
            ) : (
              <>Propose changes to <span className="text-editorial-ink">“{artwork.title}”</span>. The creator reviews every request.</>
            )}
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Body — the only part that scrolls */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7 space-y-8">
            {!isCreator && (
              <section className="space-y-5">
                <FieldSection index="01" title="Your note" />
                <div className="space-y-2.5">
                  <Label htmlFor="request_message" className={FIELD_LABEL}>
                    Message <span className="normal-case tracking-normal text-editorial-ink/40">— optional</span>
                  </Label>
                  <Textarea
                    id="request_message"
                    value={formData.request_message}
                    onChange={(e) => setFormData({ ...formData, request_message: e.target.value })}
                    placeholder="What should change, and why?"
                    rows={3}
                    className={FIELD_TEXTAREA}
                  />
                </div>
              </section>
            )}

            <section className="space-y-6">
              <FieldSection
                index={isCreator ? '01' : '02'}
                title={isCreator ? 'Details' : 'Proposed changes'}
              />

              <div className="space-y-1.5">
                <Label htmlFor="title" className={FIELD_LABEL}>Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={FIELD_INPUT}
                  required
                />
              </div>

              {isCreator && (
                <ArtworkTagPicker selectedTags={selectedTags} onChange={setSelectedTags} />
              )}

              <div className="space-y-2.5">
                <Label htmlFor="image" className={FIELD_LABEL}>Image</Label>
                {imagePreview && (
                  <figure className="relative border border-editorial-border/20 bg-cream/60 p-3">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={400}
                      height={300}
                      className="mx-auto h-auto max-h-64 w-full object-contain"
                      unoptimized
                    />
                    <figcaption className="mt-3 flex items-center justify-between border-t border-editorial-border/15 pt-2.5 font-jetbrains text-[9px] uppercase tracking-[0.18em] text-editorial-ink/50">
                      <span>{imageFile ? 'New image' : 'Current image'}</span>
                      {imageFile && (
                        <button
                          type="button"
                          onClick={removeImage}
                          className="inline-flex items-center gap-1 text-vermillion hover:text-oxblood transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Revert
                        </button>
                      )}
                    </figcaption>
                  </figure>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  id="image"
                  accept="image/*,.heic,.heif"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(BUTTON_SECONDARY, 'w-full sm:w-auto')}
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  {imagePreview ? 'Replace image' : 'Upload image'}
                </Button>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="artist_name" className={FIELD_LABEL}>Artist</Label>
                  <Input
                    id="artist_name"
                    value={formData.artist_name}
                    onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                    className={FIELD_INPUT}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="created_at" className={FIELD_LABEL}>Date certified</Label>
                  <Input
                    id="created_at"
                    type="date"
                    value={formData.created_at}
                    onChange={(e) => setFormData({ ...formData, created_at: e.target.value })}
                    className={FIELD_INPUT}
                  />
                </div>
              </div>

              {isCreator && canInviteArtistFromThisCertificate && (
                <div className="space-y-1.5">
                  <Label htmlFor="artist_invite_email" className={FIELD_LABEL}>Artist email</Label>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <Input
                      id="artist_invite_email"
                      type="email"
                      autoComplete="email"
                      value={artistInviteEmail}
                      onChange={(e) => setArtistInviteEmail(e.target.value)}
                      placeholder="artist@example.com"
                      className={FIELD_INPUT}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(BUTTON_SECONDARY, 'shrink-0')}
                      disabled={pending || !artistInviteEmail.trim()}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            const result = await sendArtistClaimInvite(artwork.id, artistInviteEmail);
                            if (!result.success) {
                              toast.error(result.error || 'Failed to send claim invite');
                              return;
                            }
                            toast.success('Claim email sent. The artist can now click Claim to create a matching Certificate of Authenticity.');
                            setArtistInviteEmail('');
                          } catch (error) {
                            console.error('[Certificates] EditArtworkDialog sendArtistClaimInvite failed', error);
                            toast.error('Failed to send claim invite');
                          }
                        });
                      }}
                    >
                      {pending ? 'Sending…' : 'Send claim invite'}
                    </Button>
                  </div>
                  <p className={FIELD_HINT}>
                    Sends a secure claim link. The artist signs in with this email and creates a linked Certificate of Authenticity.
                  </p>
                </div>
              )}
            </section>

            {exhibition && (
              <section className="space-y-6">
                <FieldSection index={isCreator ? '02' : '03'} title="Exhibition" />

                {exhibitions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="exhibitionId" className={FIELD_LABEL}>Link to exhibition</Label>
                    <Select
                      value={formData.exhibitionId || '__none__'}
                      onValueChange={(value) => {
                        setFormData({ ...formData, exhibitionId: value === '__none__' ? '' : value });
                      }}
                    >
                      <SelectTrigger id="exhibitionId" className={FIELD_INPUT}>
                        <SelectValue placeholder="Select an exhibition (optional)" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-editorial-border bg-bone">
                        <SelectItem value="__none__" className="font-serif rounded-none">
                          None
                        </SelectItem>
                        {exhibitions.map((ex) => (
                          <SelectItem key={ex.id} value={ex.id} className="font-serif rounded-none">
                            {ex.title}
                            {ex.start_date && (
                              <span className="text-xs text-editorial-ink/50 ml-2">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="exhibitionTitle" className={FIELD_LABEL}>Exhibition title</Label>
                      <Input
                        id="exhibitionTitle"
                        value={formData.exhibitionTitle}
                        onChange={(e) => setFormData({ ...formData, exhibitionTitle: e.target.value })}
                        className={FIELD_INPUT}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="exhibitionStartDate" className={FIELD_LABEL}>Opens</Label>
                        <Input
                          id="exhibitionStartDate"
                          type="date"
                          value={formData.exhibitionStartDate}
                          onChange={(e) => setFormData({ ...formData, exhibitionStartDate: e.target.value })}
                          className={FIELD_INPUT}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="exhibitionEndDate" className={FIELD_LABEL}>Closes</Label>
                        <Input
                          id="exhibitionEndDate"
                          type="date"
                          value={formData.exhibitionEndDate}
                          onChange={(e) => setFormData({ ...formData, exhibitionEndDate: e.target.value })}
                          className={FIELD_INPUT}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="exhibitionLocation" className={FIELD_LABEL}>Location</Label>
                      <Input
                        id="exhibitionLocation"
                        value={formData.exhibitionLocation}
                        onChange={(e) => setFormData({ ...formData, exhibitionLocation: e.target.value })}
                        placeholder="e.g., San Antonio, Tx"
                        className={FIELD_INPUT}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="exhibitionGallery" className={FIELD_LABEL}>Gallery</Label>
                      <Input
                        id="exhibitionGallery"
                        value={gallerySearchQuery || (exhibition.gallery?.name || '')}
                        onChange={(e) => {
                          setGallerySearchQuery(e.target.value);
                          if (!e.target.value) {
                            setFormData({ ...formData, exhibitionGalleryId: '' });
                          }
                        }}
                        placeholder="Search for a gallery…"
                        className={FIELD_INPUT}
                      />
                      {gallerySearchQuery.length >= 2 && gallerySearchResults.length > 0 && (
                        <div className="border border-editorial-border bg-bone shadow-editorial max-h-48 overflow-y-auto">
                          {gallerySearchResults.map((gallery) => (
                            <button
                              key={gallery.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, exhibitionGalleryId: gallery.id });
                                setGallerySearchQuery(gallery.name);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-editorial-ink/[0.04] transition-colors flex items-center gap-3 border-b border-editorial-border/10 last:border-b-0"
                            >
                              {gallery.picture_url && (
                                <Image
                                  src={gallery.picture_url}
                                  alt={gallery.name}
                                  width={32}
                                  height={32}
                                  className="rounded-full object-cover"
                                  unoptimized
                                />
                              )}
                              <span className="text-sm font-serif text-editorial-ink">{gallery.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {exhibition.gallery && !gallerySearchQuery && (
                        <p className={FIELD_HINT}>Current: {exhibition.gallery.name}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="border-l-2 border-vermillion/60 pl-4 space-y-1">
                    <p className="text-sm text-editorial-ink font-serif">
                      {exhibition.title}
                      {exhibition.start_date && (
                        <span className="ml-1 text-editorial-ink/60">
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
                      {exhibition.location && <span className="ml-1 text-editorial-ink/60">- {exhibition.location}</span>}
                    </p>
                    <p className={cn(FIELD_HINT, 'italic')}>
                      Only the exhibition owner can edit these details.
                    </p>
                  </div>
                )}
              </section>
            )}

            {creatorInfo && (
              <div className="flex items-baseline justify-between gap-4 border-t border-editorial-border/15 pt-4">
                <span className={FIELD_LABEL}>
                  {creatorInfo.role === 'gallery'
                    ? 'Uploaded by gallery'
                    : creatorInfo.role === 'institution'
                      ? 'Uploaded by institution'
                      : 'Created by'}
                </span>
                <span className="text-right text-sm font-serif text-editorial-ink">
                  {creatorInfo.name}
                  <span className="block font-jetbrains text-[9px] uppercase tracking-[0.18em] text-editorial-ink/40">
                    Locked
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Footer — pinned action bar */}
          <div className="shrink-0 grid grid-cols-[auto_1fr] gap-3 border-t border-editorial-border/15 bg-bone/95 backdrop-blur-sm px-5 py-3.5 sm:px-7 sm:flex sm:justify-end">
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
              className={BUTTON_SECONDARY}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className={cn(BUTTON_PRIMARY, 'group')}
            >
              {pending
                ? (isCreator ? 'Saving…' : 'Submitting…')
                : (isCreator ? 'Save changes' : 'Submit request')}
              {!pending && (
                <ArrowRight className="ml-2 h-3.5 w-3.5 text-vermillion transition-transform group-hover:translate-x-0.5" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
