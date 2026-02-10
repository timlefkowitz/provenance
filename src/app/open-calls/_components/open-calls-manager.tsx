'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { createOpenCall } from '../_actions/create-open-call';
import type { OpenCallListItem } from '../_actions/get-open-calls-for-gallery';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

export function OpenCallsManager({
  openCalls,
  galleryProfiles,
}: {
  openCalls: OpenCallListItem[];
  galleryProfiles: UserProfile[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastCreatedSlug, setLastCreatedSlug] = useState<string | null>(null);
  const defaultProfileId = galleryProfiles.length === 1 ? galleryProfiles[0].id : '';

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    slug: '',
    galleryProfileId: defaultProfileId,
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!formData.title || !formData.startDate) {
      setError('Exhibition title and start date are required.');
      return;
    }

    if (!formData.galleryProfileId) {
      setError('Please select a gallery profile.');
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
        formDataObj.append('slug', formData.slug);
        formDataObj.append('galleryProfileId', formData.galleryProfileId);

        const result = await createOpenCall(formDataObj);
        toast.success('Open call created');
        setLastCreatedSlug(result.slug);
        setFormData({
          title: '',
          description: '',
          startDate: '',
          endDate: '',
          location: '',
          slug: '',
          galleryProfileId: defaultProfileId,
        });
        router.refresh();
      } catch (submitError: any) {
        const message = submitError?.message || 'Failed to create open call.';
        setError(message);
        toast.error(message);
      }
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-10">
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-wine">
            Create Open Call
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {lastCreatedSlug && (
              <Alert className="border-wine/30 bg-wine/5">
                <AlertDescription className="font-serif text-ink/80">
                  Open call created. Public URL:{' '}
                  <Link
                    href={`/open-calls/${lastCreatedSlug}`}
                    className="text-wine underline"
                  >
                    /open-calls/{lastCreatedSlug}
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            {galleryProfiles.length > 1 && (
              <div className="space-y-2">
                <Label>Gallery Profile *</Label>
                <Select
                  value={formData.galleryProfileId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, galleryProfileId: value })
                  }
                >
                  <SelectTrigger className="font-serif">
                    <SelectValue placeholder="Select a gallery profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {galleryProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Exhibition Name *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData({ ...formData, title: event.target.value })
                  }
                  placeholder="e.g., Spring Invitational"
                  className="font-serif"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(event) =>
                    setFormData({ ...formData, description: event.target.value })
                  }
                  placeholder="Describe the open call..."
                  rows={4}
                  className="font-serif"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Exhibition Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(event) =>
                      setFormData({ ...formData, startDate: event.target.value })
                    }
                    className="font-serif"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Exhibition End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(event) =>
                      setFormData({ ...formData, endDate: event.target.value })
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
                  onChange={(event) =>
                    setFormData({ ...formData, location: event.target.value })
                  }
                  placeholder="Gallery address or venue"
                  className="font-serif"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Public URL (optional)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(event) =>
                    setFormData({ ...formData, slug: event.target.value })
                  }
                  placeholder="spring-invitational"
                  className="font-serif"
                />
                <p className="text-xs text-ink/60 font-serif">
                  Leave empty to auto-generate from the exhibition name.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={pending}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {pending ? 'Creating...' : 'Create Open Call'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-display font-bold text-wine">
          Your Open Calls
        </h2>

        {openCalls.length === 0 ? (
          <Card className="border-wine/20 bg-parchment/60">
            <CardContent className="p-8 text-center">
              <p className="text-ink/60 font-serif">
                No open calls yet. Create one above to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {openCalls.map((openCall) => (
              <Card key={openCall.id} className="border-wine/20 bg-parchment/60">
                <CardHeader>
                  <CardTitle className="font-display text-xl text-wine">
                    {openCall.exhibition.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-ink/70 font-serif">
                    {formatDate(openCall.exhibition.start_date)}
                    {openCall.exhibition.end_date &&
                      ` - ${formatDate(openCall.exhibition.end_date)}`}
                  </p>
                  {openCall.exhibition.location && (
                    <p className="text-sm text-ink/70 font-serif">
                      {openCall.exhibition.location}
                    </p>
                  )}
                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="font-serif border-wine/30 hover:bg-wine/10"
                    >
                      <Link href={`/open-calls/${openCall.slug}`}>
                        View Public Page
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="font-serif text-wine"
                    >
                      <Link href={`/exhibitions/${openCall.exhibition.id}`}>
                        Exhibition
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
