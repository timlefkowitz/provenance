'use client';

import { useState, useTransition } from 'react';
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
import { createExhibition } from '../../../exhibitions/_actions/create-exhibition';
import { Plus } from 'lucide-react';

type UserExhibition = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

export function CreateExhibitionDialog({
  onExhibitionCreated,
}: {
  onExhibitionCreated: (exhibition: UserExhibition) => void;
}) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.startDate) {
      setError('Title and start date are required');
      return;
    }

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
        formDataObj.append('artistIds', JSON.stringify([])); // Empty for now

        const result = await createExhibition(formDataObj);
        
        if (result.success && result.exhibitionId) {
          // Create the exhibition object to pass back
          const newExhibition: UserExhibition = {
            id: result.exhibitionId,
            title: formData.title,
            start_date: formData.startDate,
            end_date: formData.endDate || null,
          };
          
          toast.success('Exhibition created successfully');
          onExhibitionCreated(newExhibition);
          
          // Reset form and close dialog
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
        } else {
          throw new Error('Failed to create exhibition');
        }
      } catch (e: any) {
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
          variant="outline"
          size="sm"
          className="font-serif border-wine/30 hover:bg-wine/10"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create New Exhibition
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            Create New Exhibition
          </DialogTitle>
          <DialogDescription className="font-serif">
            Create a new exhibition and link it to your artwork
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Exhibition Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Spring Collection 2024"
              className="font-serif"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
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
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
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
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
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
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="e.g., Gallery Name, City, Country"
              className="font-serif"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="curator">Curator</Label>
            <Input
              id="curator"
              value={formData.curator}
              onChange={(e) =>
                setFormData({ ...formData, curator: e.target.value })
              }
              placeholder="e.g., Jane Smith"
              className="font-serif"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Input
              id="theme"
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
              disabled={pending}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {pending ? 'Creating...' : 'Create Exhibition'}
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

