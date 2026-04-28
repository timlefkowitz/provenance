'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { toast } from '@kit/ui/sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Building2, GalleryHorizontal, Palette, User, Plus } from 'lucide-react';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';
import { createExhibition } from '~/app/exhibitions/_actions/create-exhibition';

const MODE_ICONS: Record<string, React.ElementType> = {
  [USER_ROLES.ARTIST]: Palette,
  [USER_ROLES.COLLECTOR]: User,
  [USER_ROLES.GALLERY]: GalleryHorizontal,
  [USER_ROLES.INSTITUTION]: Building2,
};

export function NewExhibitionDialog({
  ownerRole,
  entityName,
  disabled,
  disabledReason,
}: {
  ownerRole: UserRole | null;
  entityName?: string | null;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    curator: '',
    theme: '',
  });

  const effectiveDisabled = disabled || !ownerRole;
  const modeLabel = ownerRole ? getRoleLabel(ownerRole) : '';
  const ModeIcon = ownerRole ? (MODE_ICONS[ownerRole] ?? GalleryHorizontal) : GalleryHorizontal;
  const displayLabel = ownerRole
    ? entityName
      ? `${modeLabel} (${entityName})`
      : modeLabel
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ownerRole) {
      setError('Select a mode to create an exhibition.');
      return;
    }

    if (!formData.title || !formData.startDate) {
      setError('Title and start date are required');
      return;
    }

    console.log('[Collection] NewExhibitionDialog submit', { ownerRole, entityName });

    startTransition(async () => {
      try {
        const formDataObj = new FormData();
        formDataObj.append('title', formData.title);
        formDataObj.append('description', formData.description);
        formDataObj.append('startDate', formData.startDate);
        formDataObj.append('endDate', formData.endDate || '');
        formDataObj.append('location', formData.location);
        formDataObj.append('curator', formData.curator);
        formDataObj.append('theme', formData.theme);
        formDataObj.append('artistIds', JSON.stringify([]));
        formDataObj.append('ownerRole', ownerRole);

        const result = await createExhibition(formDataObj);

        if (!result?.success || !result.exhibitionId) {
          throw new Error('Failed to create exhibition');
        }

        toast.success('Exhibition created. Add details and artworks.');
        setFormData({
          title: '',
          description: '',
          startDate: '',
          endDate: '',
          location: '',
          curator: '',
          theme: '',
        });
        setOpen(false);

        // Redirect to the edit page so the user can fill in details
        // (description, dates, location, image, curator, theme) before
        // artworks or certificates are ready.
        router.push(`/exhibitions/${result.exhibitionId}/edit`);
        router.refresh();
      } catch (e: any) {
        console.error('[Collection] NewExhibitionDialog failed', e);
        const errorMessage = e?.message || 'Failed to create exhibition';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          disabled={effectiveDisabled}
          title={effectiveDisabled ? disabledReason : undefined}
          aria-disabled={effectiveDisabled}
          className="bg-ink text-parchment hover:bg-ink/90 font-serif h-10 px-4 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Exhibition
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            New Exhibition
          </DialogTitle>
          <DialogDescription className="font-serif">
            Create the exhibition, then add details and artworks.
          </DialogDescription>
        </DialogHeader>

        {/* Mode indicator — always visible before form fields */}
        {ownerRole ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-ink/15 bg-ink px-3.5 py-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-parchment/15">
              <ModeIcon className="h-3.5 w-3.5 text-parchment" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-landing font-light tracking-[0.25em] uppercase text-parchment/60">
                Creating as
              </p>
              <p className="font-serif text-sm font-semibold text-parchment leading-tight truncate">
                {displayLabel}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-wine/20 bg-wine/5 px-3.5 py-2.5">
            <p className="font-serif text-sm text-wine/80">
              Select a mode to create an exhibition.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-exhibition-title">Exhibition Title *</Label>
            <Input
              id="new-exhibition-title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Spring Collection 2026"
              className="font-serif"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-exhibition-description">Description</Label>
            <Textarea
              id="new-exhibition-description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe the exhibition..."
              rows={3}
              className="font-serif"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-exhibition-start">Start Date *</Label>
              <Input
                id="new-exhibition-start"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="font-serif"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-exhibition-end">End Date</Label>
              <Input
                id="new-exhibition-end"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="font-serif"
                min={formData.startDate}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-exhibition-location">Location</Label>
            <Input
              id="new-exhibition-location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="e.g., Gallery Name, City, Country"
              className="font-serif"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-exhibition-curator">Curator</Label>
            <Input
              id="new-exhibition-curator"
              value={formData.curator}
              onChange={(e) =>
                setFormData({ ...formData, curator: e.target.value })
              }
              placeholder="e.g., Jane Smith"
              className="font-serif"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-exhibition-theme">Theme</Label>
            <Input
              id="new-exhibition-theme"
              value={formData.theme}
              onChange={(e) =>
                setFormData({ ...formData, theme: e.target.value })
              }
              placeholder="e.g., Abstract Expressionism"
              className="font-serif"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={pending || effectiveDisabled}
              className="bg-ink text-parchment hover:bg-ink/90 font-serif"
            >
              {pending ? 'Creating…' : 'Create exhibition'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="font-serif border-wine/30 hover:bg-wine/10"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
