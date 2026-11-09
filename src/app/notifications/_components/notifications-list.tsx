'use client';

import { useState, useTransition, useRef, useCallback, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  MessageSquare,
  FileText,
  UserPlus,
  ScrollText,
  Users,
  GalleryVerticalEnd,
  Heart,
  X,
} from 'lucide-react';
import { Button } from '@kit/ui/button';
import {
  dismissNotification,
  markNotificationAsRead,
  setNotificationRead,
} from '../_actions/manage-notifications';
import { claimCertificate } from '~/app/artworks/[id]/_actions/claim-certificate';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  artwork_id: string | null;
  related_user_id: string | null;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export function NotificationsList({
  notifications,
}: {
  notifications: Notification[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [claimingNotificationId, setClaimingNotificationId] = useState<string | null>(null);
  const [completedArtworkIds, setCompletedArtworkIds] = useState<string[]>([]);
  // Use ref to track in-flight requests to prevent duplicates even during re-renders
  const inFlightRequests = useRef<Set<string>>(new Set());

  // Optimistic state so the icons respond on tap; rolled back if the save fails.
  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const refreshIfIdle = useCallback(() => {
    // Only refresh if we're not in the middle of another operation
    if (inFlightRequests.current.size === 0) {
      router.refresh();
    }
  }, [router]);

  const handleToggleRead = useCallback(async (notificationId: string, read: boolean) => {
    setReadOverrides((prev) => ({ ...prev, [notificationId]: read }));
    try {
      await setNotificationRead(notificationId, read);
      refreshIfIdle();
    } catch (error) {
      console.error('Error updating notification read state:', error);
      setReadOverrides((prev) => ({ ...prev, [notificationId]: !read }));
    }
  }, [refreshIfIdle]);

  // Following one of a notification's links counts as reading it.
  const handleActionClick = useCallback((notificationId: string, isRead: boolean, event: MouseEvent) => {
    if (isRead || !(event.target as HTMLElement).closest('a')) return;
    setReadOverrides((prev) => ({ ...prev, [notificationId]: true }));
    void markNotificationAsRead(notificationId).catch((error) => {
      console.error('Error marking notification as read:', error);
    });
  }, []);

  const handleDismiss = useCallback(async (notificationId: string) => {
    setDismissedIds((prev) => new Set(prev).add(notificationId));
    try {
      await dismissNotification(notificationId);
      refreshIfIdle();
    } catch (error) {
      console.error('Error dismissing notification:', error);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  }, [refreshIfIdle]);

  const handleClaimCertificate = useCallback((notificationId: string, artworkId: string) => {
    const requestKey = `claim-${artworkId}`;
    
    // Prevent duplicate clicks using both state and ref
    if (inFlightRequests.current.has(requestKey)) {
      return;
    }
    
    inFlightRequests.current.add(requestKey);
    setClaimingNotificationId(notificationId);
    
    startTransition(async () => {
      try {
        await claimCertificate(artworkId);
        setCompletedArtworkIds((prev) =>
          prev.includes(artworkId) ? prev : [...prev, artworkId],
        );
        // Use router.push to force a full navigation instead of refresh
        // This avoids server component render errors
        setTimeout(() => {
          router.push('/notifications');
        }, 300);
      } catch (error) {
        console.error('Error claiming certificate:', error);
        alert((error as Error).message || 'Failed to claim certificate');
        inFlightRequests.current.delete(requestKey);
        setClaimingNotificationId(null);
      }
    });
  }, [router]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'certificate_claim_request':
      case 'certificate_claimed':
      case 'certificate_received':
      case 'certificate_verified':
      case 'artist_claim_request':
      case 'artist_claim_approved':
      case 'artist_claim_denied':
      case 'artist_claim_other_certificates':
      case 'certificate_claim_pending':
      case 'provenance_updated':
        return <FileText className="h-5 w-5" />;
      case 'artist_profile_claim_request':
      case 'artist_profile_claim_approved':
      case 'artist_profile_claim_rejected':
        return <UserPlus className="h-5 w-5" />;
      case 'gallery_team_invite':
        return <Users className="h-5 w-5" />;
      case 'exhibition_invite':
      case 'open_call_submission_reminder':
      case 'exhibition_artwork_submitted':
      case 'exhibition_artwork_selected':
      case 'exhibition_artwork_sold':
      case 'artist_artwork_sold':
      case 'artist_artwork_exhibited':
      case 'owned_artwork_exhibited':
      case 'artwork_reservation_request':
      case 'artwork_reservation_response':
        return <GalleryVerticalEnd className="h-5 w-5" />;
      case 'artwork_inquiry':
        return <MessageSquare className="h-5 w-5" />;
      case 'new_work_by_followed_artist':
        return <Heart className="h-5 w-5" />;
      case 'message':
        return <MessageSquare className="h-5 w-5" />;
      case 'provenance_service_request':
        return <ScrollText className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'certificate_verified':
      case 'certificate_received':
      case 'artist_profile_claim_approved':
      case 'artist_claim_approved':
      case 'exhibition_artwork_selected':
      case 'exhibition_artwork_sold':
      case 'artist_artwork_sold':
      case 'artist_artwork_exhibited':
      case 'owned_artwork_exhibited':
      case 'artwork_reservation_response':
        return 'text-notify-success';
      case 'artwork_reservation_request':
      case 'artwork_inquiry':
        return 'text-wine';
      case 'new_work_by_followed_artist':
        return 'text-wine';
      case 'certificate_claimed':
        return 'text-notify-info';
      case 'certificate_claim_request':
      case 'artist_profile_claim_request':
      case 'artist_claim_request':
        return 'text-wine';
      case 'artist_profile_claim_rejected':
      case 'artist_claim_denied':
      case 'invite_email_failed':
        return 'text-notify-error';
      case 'artist_claim_other_certificates':
        return 'text-ink';
      case 'provenance_service_request':
        return 'text-wine';
      case 'certificate_claim_pending':
        return 'text-notify-warning';
      case 'provenance_updated':
        return 'text-notify-info';
      case 'gallery_team_invite':
      case 'exhibition_invite':
      case 'open_call_submission_reminder':
        return 'text-wine';
      default:
        return 'text-ink';
    }
  };

  const visible = notifications
    .filter((n) => !dismissedIds.has(n.id))
    .map((n) => ({ ...n, read: readOverrides[n.id] ?? n.read }));

  if (visible.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink/60 font-serif">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((notification) => (
        <div
          key={notification.id}
          className={`border rounded-lg p-4 ${
            notification.read 
              ? 'bg-parchment/50 border-wine/20' 
              : 'bg-white border-wine/40 shadow-sm'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`mt-1 ${getNotificationColor(notification.type)}`}>
              {getNotificationIcon(notification.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className={`font-serif font-semibold mb-1 ${
                    notification.read ? 'text-ink/70' : 'text-ink'
                  }`}>
                    {notification.title}
                  </h3>
                  {notification.message && (
                    <p className={`text-sm font-serif mb-2 ${
                      notification.read ? 'text-ink/60' : 'text-ink/80'
                    }`}>
                      {notification.type === 'certificate_claimed' && notification.related_user_id ? (() => {
                        // Extract the artist name from the message
                        // Format: "{name} has claimed the certificate for..."
                        const message = notification.message;
                        const hasClaimedIndex = message.indexOf(' has claimed');
                        if (hasClaimedIndex > 0) {
                          const artistName = message.substring(0, hasClaimedIndex);
                          const restOfMessage = message.substring(hasClaimedIndex);
                          return (
                            <>
                              <Link 
                                href={`/artists/${notification.related_user_id}`}
                                className="font-semibold text-wine hover:text-wine/80 underline"
                              >
                                {artistName}
                              </Link>
                              {restOfMessage}
                            </>
                          );
                        }
                        return notification.message;
                      })() : (
                        notification.message
                      )}
                    </p>
                  )}
                  
                  {/* Action buttons based on notification type */}
                  <div
                    className="flex flex-wrap gap-2 mt-3"
                    onClickCapture={(e) => handleActionClick(notification.id, notification.read, e)}
                  >
                    {notification.artwork_id && (
                      <Link href={`/artworks/${notification.artwork_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          View Artwork
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'provenance_service_request' && notification.artwork_id && (
                      <Link href={`/artworks/${notification.artwork_id}/certificate`}>
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          View certificate
                        </Button>
                      </Link>
                    )}
                    
                    {notification.type === 'certificate_claim_request' && notification.artwork_id && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleClaimCertificate(notification.id, notification.artwork_id!)}
                        disabled={
                          pending ||
                          claimingNotificationId === notification.id ||
                          completedArtworkIds.includes(notification.artwork_id)
                        }
                        className="font-serif bg-wine text-parchment hover:bg-wine/90"
                      >
                        {completedArtworkIds.includes(notification.artwork_id)
                          ? 'Claimed'
                          : claimingNotificationId === notification.id
                            ? 'Claiming...'
                            : 'Claim Certificate'}
                      </Button>
                    )}
                    
                    {notification.type === 'certificate_claimed' && notification.artwork_id && (
                      <Link href={`/artworks/${notification.artwork_id}/certificate?verify=1`}>
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          Verify Certificate
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'certificate_received' && notification.artwork_id && (
                      <Link href={`/artworks/${notification.artwork_id}/certificate`}>
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          View Certificate
                        </Button>
                      </Link>
                    )}

                    {(notification.type === 'provenance_update_request' ||
                      notification.type === 'ownership_request') && (
                      <Link href="/portal">
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          Review in Portal
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'artist_claim_request' && notification.artwork_id && (
                      <Link href="/portal">
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          Review in Portal
                        </Button>
                      </Link>
                    )}

                    {(notification.type === 'artist_claim_approved' || notification.type === 'artist_claim_denied') && notification.artwork_id && (
                      <Link href={`/artworks/${notification.artwork_id}/certificate`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          {notification.type === 'artist_claim_approved' ? 'View Certificate' : 'View Certificate'}
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'artist_claim_other_certificates' && (
                      <Link href="/portal">
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          Go to Portal
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'invite_email_failed' && (
                      <Link
                        href={
                          notification.artwork_id
                            ? `/artworks/${notification.artwork_id}/certificate`
                            : '/artworks/edit-provenance'
                        }
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          Resend invite
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'certificate_claim_pending' && (
                      <Link href="/portal/pending-claims">
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          View pending certificate claims
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'provenance_updated' && notification.artwork_id && (
                      <Link href={`/artworks/${notification.artwork_id}/certificate`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          View linked certificate
                        </Button>
                      </Link>
                    )}
                    
                    {(notification.type === 'artist_profile_claim_request' || 
                      notification.type === 'artist_profile_claim_approved' || 
                      notification.type === 'artist_profile_claim_rejected') && (
                      <Link href="/profiles/claims">
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          View Claims
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'exhibition_invite' &&
                      typeof notification.metadata?.submit_path === 'string' &&
                      notification.metadata.submit_path.startsWith('/exhibitions/submit?') && (
                      <Link href={notification.metadata.submit_path}>
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          Submit your work
                        </Button>
                      </Link>
                    )}

                    {(notification.type === 'exhibition_invite' ||
                      notification.type === 'exhibition_artwork_submitted') &&
                      typeof notification.metadata?.open_call_slug === 'string' && (
                      <Link href={`/open-calls/${notification.metadata.open_call_slug}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          View open call
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'open_call_submission_reminder' &&
                      typeof notification.metadata?.open_call_slug === 'string' && (
                      <Link href={`/open-calls/${notification.metadata.open_call_slug}`}>
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          Continue your submission
                        </Button>
                      </Link>
                    )}

                    {(notification.type === 'exhibition_artwork_submitted' ||
                      notification.type === 'exhibition_artwork_selected') &&
                      typeof notification.metadata?.exhibition_id === 'string' && (
                      <Link
                        href={
                          notification.type === 'exhibition_artwork_submitted'
                            ? `/exhibitions/${notification.metadata.exhibition_id}/edit#submissions`
                            : typeof notification.metadata.open_call_slug === 'string'
                              ? `/open-calls/${notification.metadata.open_call_slug}`
                              : `/exhibitions/${notification.metadata.exhibition_id}`
                        }
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          {notification.type === 'exhibition_artwork_submitted'
                            ? 'Review submissions'
                            : typeof notification.metadata.open_call_slug === 'string'
                              ? 'View your submission'
                              : 'View exhibition'}
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'artwork_inquiry' && notification.artwork_id && (
                      <Link
                        href={
                          typeof notification.metadata?.exhibition_id === 'string'
                            ? `/exhibitions/${notification.metadata.exhibition_id}#inquiries`
                            : `/artworks/${notification.artwork_id}/inquiries`
                        }
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          View inquiry
                        </Button>
                      </Link>
                    )}

                    {(notification.type === 'owned_artwork_exhibited' ||
                      notification.type === 'artwork_reservation_request' ||
                      notification.type === 'artwork_reservation_response') &&
                      typeof notification.metadata?.exhibition_id === 'string' && (
                      <Link href={`/exhibitions/${notification.metadata.exhibition_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-serif border-wine/30 hover:bg-wine/10"
                        >
                          {notification.type === 'artwork_reservation_request'
                            ? 'Review request'
                            : 'View exhibition'}
                        </Button>
                      </Link>
                    )}

                    {notification.type === 'gallery_team_invite' && (
                      <Link href="/portal">
                        <Button
                          variant="default"
                          size="sm"
                          className="font-serif bg-wine text-parchment hover:bg-wine/90"
                        >
                          Go to Portal
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-ink/50 font-serif mr-1">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleRead(notification.id, !notification.read)}
                    className="p-2 hover:bg-wine/10 rounded"
                    title={notification.read ? 'Mark as unread' : 'Mark as read'}
                    aria-label={notification.read ? 'Mark as unread' : 'Mark as read'}
                  >
                    {notification.read ? (
                      <CheckCircle2 className="h-4 w-4 text-ink/40" />
                    ) : (
                      <Circle className="h-4 w-4 text-wine" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(notification.id)}
                    className="p-2 hover:bg-wine/10 rounded text-ink/50 hover:text-ink"
                    title="Dismiss"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

