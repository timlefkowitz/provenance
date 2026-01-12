'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar, MapPin, Edit, Trash2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { deleteExhibition } from '../_actions/delete-exhibition';
import { toast } from '@kit/ui/sonner';
import { useRouter } from 'next/navigation';
import type { Exhibition } from '../_actions/get-exhibitions';

export function ExhibitionsList({
  exhibitions,
  galleryId,
}: {
  exhibitions: Exhibition[];
  galleryId: string;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (exhibitionId: string) => {
    try {
      setDeletingId(exhibitionId);
      await deleteExhibition(exhibitionId);
      toast.success('Exhibition deleted successfully');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete exhibition');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          asChild
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          <Link href="/exhibitions/new">
            <Plus className="h-4 w-4 mr-2" />
            New Exhibition
          </Link>
        </Button>
      </div>

      {exhibitions.length === 0 ? (
        <Card className="border-wine/20 bg-parchment/60">
          <CardContent className="p-12 text-center">
            <p className="text-ink/60 font-serif text-lg mb-4">
              No exhibitions yet
            </p>
            <Button
              asChild
              variant="outline"
              className="font-serif border-wine/30 hover:bg-wine/10"
            >
              <Link href="/exhibitions/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Exhibition
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exhibitions.map((exhibition) => (
            <Card
              key={exhibition.id}
              className="border-wine/20 bg-parchment/60 hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="font-display text-xl text-wine pr-4">
                    {exhibition.title}
                  </CardTitle>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Link href={`/exhibitions/${exhibition.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          disabled={deletingId === exhibition.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Exhibition</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{exhibition.title}&quot;?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(exhibition.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {exhibition.description && (
                  <p className="text-ink/80 font-serif text-sm line-clamp-2">
                    {exhibition.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-sm text-ink/70">
                  <Calendar className="h-4 w-4" />
                  <span className="font-serif">
                    {formatDate(exhibition.start_date)}
                    {exhibition.end_date &&
                      ` - ${formatDate(exhibition.end_date)}`}
                  </span>
                </div>
                {exhibition.location && (
                  <div className="flex items-center gap-2 text-sm text-ink/70">
                    <MapPin className="h-4 w-4" />
                    <span className="font-serif">{exhibition.location}</span>
                  </div>
                )}
                <div className="pt-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="font-serif border-wine/30 hover:bg-wine/10"
                  >
                    <Link href={`/exhibitions/${exhibition.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

