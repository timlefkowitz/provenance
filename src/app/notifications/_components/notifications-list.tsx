'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, AlertCircle, MessageSquare, FileText, UserPlus } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { markNotificationAsRead } from '~/lib/notifications';
import { claimCertificate } from '~/app/artworks/[id]/_actions/claim-certificate';
import { verifyCertificate } from '~/app/artworks/[id]/_actions/verify-certificate';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  artwork_id: string | null;
  related_user_id: string | null;
  read: boolean;
  created_at: string;
  metadata: Record<string, any> | null;
};

export function NotificationsList({ 
  notifications, 
  userId 
}: { 
  notifications: Notification[];
  userId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [verifyingNotificationId, setVerifyingNotificationId] = useState<string | null>(null);
  const [claimingNotificationId, setClaimingNotificationId] = useState<string | null>(null);
  const [completedArtworkIds, setCompletedArtworkIds] = useState<string[]>([]);
  // Use ref to track in-flight requests to prevent duplicates even during re-renders
  const inFlightRequests = useRef<Set<string>>(new Set());

  const handleMarkAsRead = useCallback((notificationId: string) => {
    startTransition(async () => {
      try {
        await markNotificationAsRead(notificationId, userId);
        // Only refresh if we're not in the middle of another operation
        if (inFlightRequests.current.size === 0) {
          router.refresh();
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    });
  }, [userId, router]);

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
      } catch (error: any) {
        console.error('Error claiming certificate:', error);
        alert(error.message || 'Failed to claim certificate');
        inFlightRequests.current.delete(requestKey);
        setClaimingNotificationId(null);
      }
    });
  }, [router]);

  const handleVerifyCertificate = useCallback((notificationId: string, artworkId: string) => {
    const requestKey = `verify-${artworkId}`;

    // Prevent duplicate clicks using both state and ref
    if (inFlightRequests.current.has(requestKey)) {
      return;
    }

    inFlightRequests.current.add(requestKey);
    setVerifyingNotificationId(notificationId);

    startTransition(async () => {
      try {
        const result = await verifyCertificate(artworkId);
        if (result.success) {
          setCompletedArtworkIds((prev) =>
            prev.includes(artworkId) ? prev : [...prev, artworkId],
          );
          setTimeout(() => {
            router.push('/notifications');
          }, 300);
        } else {
          alert(result.error || 'Failed to verify certificate');
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to verify certificate';
        console.error('Error verifying certificate:', error);
        alert(
          message === 'Failed to fetch'
            ? 'Network error. Please check your connection and try again.'
            : message,
        );
      } finally {
        inFlightRequests.current.delete(requestKey);
        setVerifyingNotificationId(null);
      }
    });
  }, [router]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'certificate_claim_request':
      case 'certificate_claimed':
      case 'certificate_verified':
        return <FileText className="h-5 w-5" />;
      case 'artist_profile_claim_request':
      case 'artist_profile_claim_approved':
      case 'artist_profile_claim_rejected':
        return <UserPlus className="h-5 w-5" />;
      case 'message':
        return <MessageSquare className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'certificate_verified':
      case 'artist_profile_claim_approved':
        return 'text-green-600';
      case 'certificate_claimed':
        return 'text-blue-600';
      case 'certificate_claim_request':
      case 'artist_profile_claim_request':
        return 'text-wine';
      case 'artist_profile_claim_rejected':
        return 'text-red-600';
      default:
        return 'text-ink';
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink/60 font-serif">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
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
                  <div className="flex gap-2 mt-3">
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
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleVerifyCertificate(notification.id, notification.artwork_id!)}
                        disabled={
                          pending ||
                          verifyingNotificationId === notification.id ||
                          completedArtworkIds.includes(notification.artwork_id)
                        }
                        className="font-serif bg-wine text-parchment hover:bg-wine/90"
                      >
                        {completedArtworkIds.includes(notification.artwork_id)
                          ? 'Verified'
                          : verifyingNotificationId === notification.id
                            ? 'Verifying...'
                            : 'Verify Certificate'}
                      </Button>
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
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="p-1 hover:bg-wine/10 rounded"
                    title={notification.read ? 'Mark as unread' : 'Mark as read'}
                  >
                    {notification.read ? (
                      <CheckCircle2 className="h-4 w-4 text-ink/40" />
                    ) : (
                      <Circle className="h-4 w-4 text-wine" />
                    )}
                  </button>
                  <span className="text-xs text-ink/50 font-serif">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

