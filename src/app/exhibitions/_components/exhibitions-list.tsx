'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar, MapPin, Edit, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@kit/ui/button';
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

function getStatus(ex: Exhibition): 'upcoming' | 'ongoing' | 'past' {
  const now = new Date();
  const start = new Date(ex.start_date);
  const end = ex.end_date ? new Date(ex.end_date) : null;
  if (start > now) return 'upcoming';
  if (!end || end >= now) return 'ongoing';
  return 'past';
}

const STATUS_STYLES = {
  upcoming: { dot: 'bg-sky-400',     label: 'Upcoming', text: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200' },
  ongoing:  { dot: 'bg-emerald-400', label: 'Ongoing',  text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  past:     { dot: 'bg-ink/25',      label: 'Past',     text: 'text-ink/40',      bg: 'bg-ink/5 border-ink/10' },
};

function formatRange(start: string, end: string | null) {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const s = new Date(start).toLocaleDateString('en-US', opts);
  if (!end) return s;
  const e = new Date(end);
  const eYear = e.getFullYear();
  const sYear = new Date(start).getFullYear();
  // Same year — omit year from start
  const eStr = e.toLocaleDateString('en-US', opts);
  const sStr = sYear === eYear
    ? new Date(start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : s;
  return `${sStr} – ${eStr}`;
}

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
      toast.success('Exhibition removed');
      router.refresh();
    } catch (error: any) {
      console.error('[ExhibitionsList] Error deleting exhibition', error);
      toast.error(error.message || 'Failed to delete exhibition');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between mb-12">
        <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif">
          {exhibitions.length} Exhibition{exhibitions.length !== 1 ? 's' : ''}
        </p>
        <Button
          asChild
          size="sm"
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          <Link href="/exhibitions/new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Exhibition
          </Link>
        </Button>
      </div>

      {exhibitions.length === 0 ? (
        /* ── Empty state ── */
        <div className="text-center py-32 border border-dashed border-wine/15 rounded-2xl">
          <p className="text-[10px] uppercase tracking-widest text-ink/30 font-serif mb-4">
            No Exhibitions Yet
          </p>
          <p className="text-ink/40 font-serif text-sm mb-8 max-w-xs mx-auto">
            Create your first exhibition to start showcasing artworks and artists.
          </p>
          <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
            <Link href="/exhibitions/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Exhibition
            </Link>
          </Button>
        </div>
      ) : (
        /* ── Exhibition index ── */
        <ol className="divide-y divide-wine/10">
          {exhibitions.map((ex, i) => {
            const status = getStatus(ex);
            const styles = STATUS_STYLES[status];
            return (
              <li key={ex.id} className="group">
                <div className="flex items-start gap-6 py-8 md:py-10">
                  {/* Catalogue number */}
                  <span className="hidden sm:block w-10 shrink-0 text-[11px] font-serif text-ink/25 pt-1 select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {/* Status */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                          <span className={`text-[10px] uppercase tracking-widest font-serif ${styles.text}`}>
                            {styles.label}
                          </span>
                        </div>

                        {/* Title */}
                        <Link
                          href={`/exhibitions/${ex.id}`}
                          className="block group/title"
                        >
                          <h2 className="font-display text-2xl md:text-3xl font-bold text-ink group-hover/title:text-wine transition-colors leading-tight mb-3">
                            {ex.title}
                          </h2>
                        </Link>

                        {/* Description */}
                        {ex.description && (
                          <p className="text-ink/55 font-serif text-sm leading-relaxed mb-3 max-w-xl line-clamp-2">
                            {ex.description}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink/45 font-serif">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-wine/40" />
                            {formatRange(ex.start_date, ex.end_date)}
                          </span>
                          {ex.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-wine/40" />
                              {ex.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-ink/40 hover:text-wine hover:bg-wine/10"
                        >
                          <Link href={`/exhibitions/${ex.id}`} aria-label="View exhibition">
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-ink/40 hover:text-wine hover:bg-wine/10"
                        >
                          <Link href={`/exhibitions/${ex.id}/edit`} aria-label="Edit exhibition">
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-ink/40 hover:text-red-600 hover:bg-red-50"
                              disabled={deletingId === ex.id}
                              aria-label="Delete exhibition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Exhibition</AlertDialogTitle>
                              <AlertDialogDescription className="font-serif text-sm">
                                Permanently delete &ldquo;{ex.title}&rdquo;? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(ex.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
