'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePWA } from '~/components/pwa/pwa-provider';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | null;
  isLoading: boolean;
  error: string | null;
}

// VAPID public key should be set in environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { swRegistration } = usePWA();
  
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: null,
    isLoading: false,
    error: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const isSupported = 
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : null,
    }));
  }, []);

  // Check existing subscription
  useEffect(() => {
    async function checkSubscription() {
      if (!swRegistration) return;

      try {
        const subscription = await swRegistration.pushManager.getSubscription();
        setState(prev => ({
          ...prev,
          isSubscribed: !!subscription,
        }));
      } catch (error) {
        console.error('[Push] Failed to check subscription:', error);
      }
    }

    checkSubscription();
  }, [swRegistration]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setState(prev => ({ ...prev, error: 'Notifications not supported' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      
      setState(prev => ({
        ...prev,
        permission,
        isLoading: false,
      }));

      return permission === 'granted';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return false;
    }
  }, []);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!swRegistration) {
      setState(prev => ({ ...prev, error: 'Service worker not registered' }));
      return null;
    }

    if (!VAPID_PUBLIC_KEY) {
      setState(prev => ({ ...prev, error: 'Push notifications not configured' }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setState(prev => ({ ...prev, isLoading: false }));
          return null;
        }
      }

      // Subscribe to push
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return subscription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return null;
    }
  }, [swRegistration, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!swRegistration) {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      
      if (subscription) {
        // Notify server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unsubscribe';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return false;
    }
  }, [swRegistration]);

  const showLocalNotification = useCallback(async (
    title: string,
    options?: NotificationOptions
  ): Promise<boolean> => {
    if (Notification.permission !== 'granted') {
      return false;
    }

    if (swRegistration) {
      await swRegistration.showNotification(title, {
        icon: '/icons/icon-192x192.jpg',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        ...options,
      });
      return true;
    }

    return false;
  }, [swRegistration]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocalNotification,
  };
}
