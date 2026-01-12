'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, AlertCircle, MessageSquare, FileText } from 'lucide-react';
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

  const handleMarkAsRead = (notificationId: string) => {
    startTransition(async () => {
      try {
        await markNotificationAsRead(notificationId, userId);
        router.refresh();
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    });
  };

  const handleClaimCertificate = (artworkId: string) => {
    startTransition(async () => {
      try {
        await claimCertificate(artworkId);
        router.refresh();
      } catch (error: any) {
        alert(error.message || 'Failed to claim certificate');
      }
    });
  };

  const handleVerifyCertificate = (artworkId: string) => {
    startTransition(async () => {
      try {
        await verifyCertificate(artworkId);
        router.refresh();
      } catch (error: any) {
        alert(error.message || 'Failed to verify certificate');
      }
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'certificate_claim_request':
      case 'certificate_claimed':
      case 'certificate_verified':
        return <FileText className="h-5 w-5" />;
      case 'message':
        return <MessageSquare className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'certificate_verified':
        return 'text-green-600';
      case 'certificate_claimed':
        return 'text-blue-600';
      case 'certificate_claim_request':
        return 'text-wine';
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
                      {notification.message}
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
                        onClick={() => handleClaimCertificate(notification.artwork_id!)}
                        disabled={pending}
                        className="font-serif bg-wine text-parchment hover:bg-wine/90"
                      >
                        Claim Certificate
                      </Button>
                    )}
                    
                    {notification.type === 'certificate_claimed' && notification.artwork_id && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleVerifyCertificate(notification.artwork_id!)}
                        disabled={pending}
                        className="font-serif bg-wine text-parchment hover:bg-wine/90"
                      >
                        Verify Certificate
                      </Button>
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

