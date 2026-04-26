'use client';

import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Switch } from '@kit/ui/switch';
import { usePushNotifications } from '~/hooks/use-push-notifications';
import { cn } from '@kit/ui/utils';

interface NotificationSettingsProps {
  className?: string;
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  if (!isSupported) {
    return (
      <div className={cn('flex items-center gap-3 p-4 rounded-lg bg-muted/50', className)}>
        <BellOff className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="text-xs text-muted-foreground">
            Not supported on this device
          </p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className={cn('flex items-center gap-3 p-4 rounded-lg bg-destructive/10', className)}>
        <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Notifications Blocked</p>
          <p className="text-xs text-muted-foreground">
            Enable notifications in your browser settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
        <Bell className={cn('w-5 h-5 shrink-0', isSubscribed ? 'text-wine' : 'text-muted-foreground')} />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="text-xs text-muted-foreground">
            {isSubscribed 
              ? 'You&apos;ll receive updates about your artworks' 
              : 'Get notified about artwork updates and sales'}
          </p>
        </div>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            aria-label="Toggle push notifications"
          />
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive px-4">{error}</p>
      )}

      {!isSubscribed && permission !== 'granted' && (
        <Button
          onClick={subscribe}
          disabled={isLoading}
          className="w-full gap-2"
          variant="outline"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          Enable Notifications
        </Button>
      )}
    </div>
  );
}
