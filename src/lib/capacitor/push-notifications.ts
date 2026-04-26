/**
 * Native Push Notifications Service for Capacitor
 * 
 * Provides native push notification access on iOS with fallback to web APIs.
 */

import { isNative } from './index';

export interface PushNotificationToken {
  value: string;
}

export interface PushNotification {
  id: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export type PushNotificationListener = (notification: PushNotification) => void;

// Lazy load Capacitor Push Notifications plugin
const getCapacitorPush = async () => {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return PushNotifications;
  } catch {
    console.warn('Capacitor Push Notifications plugin not available');
    return null;
  }
};

/**
 * Check push notification permissions
 */
export async function checkPushPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
  const PushNotifications = await getCapacitorPush();
  
  if (PushNotifications) {
    const permissions = await PushNotifications.checkPermissions();
    return permissions.receive;
  }
  
  // Web fallback
  if ('Notification' in window) {
    return Notification.permission as 'granted' | 'denied' | 'prompt';
  }
  
  return 'denied';
}

/**
 * Request push notification permissions
 */
export async function requestPushPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
  const PushNotifications = await getCapacitorPush();
  
  if (PushNotifications) {
    const permissions = await PushNotifications.requestPermissions();
    return permissions.receive;
  }
  
  // Web fallback
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    return result as 'granted' | 'denied' | 'prompt';
  }
  
  return 'denied';
}

/**
 * Register for push notifications and get device token
 */
export async function registerForPush(): Promise<PushNotificationToken | null> {
  const PushNotifications = await getCapacitorPush();
  
  if (PushNotifications) {
    return new Promise((resolve) => {
      // Listen for registration success
      PushNotifications.addListener('registration', (token) => {
        resolve({ value: token.value });
      });
      
      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
        resolve(null);
      });
      
      // Register
      PushNotifications.register();
    });
  }
  
  // Web fallback - use service worker push
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      
      return { value: JSON.stringify(subscription) };
    } catch (error) {
      console.error('Web push registration error:', error);
    }
  }
  
  return null;
}

/**
 * Add listener for received notifications (when app is open)
 */
export async function addNotificationReceivedListener(
  callback: PushNotificationListener
): Promise<() => void> {
  const PushNotifications = await getCapacitorPush();
  
  if (PushNotifications) {
    const listener = await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        callback({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          data: notification.data,
        });
      }
    );
    
    return () => listener.remove();
  }
  
  // Web fallback - not applicable for foreground web push
  return () => {};
}

/**
 * Add listener for notification taps (when user taps notification)
 */
export async function addNotificationActionListener(
  callback: PushNotificationListener
): Promise<() => void> {
  const PushNotifications = await getCapacitorPush();
  
  if (PushNotifications) {
    const listener = await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        callback({
          id: action.notification.id,
          title: action.notification.title,
          body: action.notification.body,
          data: action.notification.data,
        });
      }
    );
    
    return () => listener.remove();
  }
  
  // Web fallback
  return () => {};
}

/**
 * Get delivered notifications (iOS only)
 */
export async function getDeliveredNotifications(): Promise<PushNotification[]> {
  const PushNotifications = await getCapacitorPush();
  
  if (PushNotifications) {
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      data: n.data,
    }));
  }
  
  return [];
}

/**
 * Remove all delivered notifications
 */
export async function removeAllDeliveredNotifications(): Promise<void> {
  const PushNotifications = await getCapacitorPush();
  
  if (PushNotifications) {
    await PushNotifications.removeAllDeliveredNotifications();
  }
}
