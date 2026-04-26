/**
 * Native Haptics Service for Capacitor
 * 
 * Provides native haptic feedback on iOS with web fallback.
 */

import { isNative } from './index';

export type HapticImpactStyle = 'heavy' | 'medium' | 'light';
export type HapticNotificationType = 'success' | 'warning' | 'error';

// Lazy load Capacitor Haptics plugin
const getCapacitorHaptics = async () => {
  if (!isNative()) return null;
  try {
    const { Haptics } = await import('@capacitor/haptics');
    return Haptics;
  } catch {
    console.warn('Capacitor Haptics plugin not available');
    return null;
  }
};

/**
 * Trigger impact haptic feedback
 */
export async function impact(style: HapticImpactStyle = 'medium'): Promise<void> {
  const Haptics = await getCapacitorHaptics();
  
  if (Haptics) {
    const { ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({
      style: style === 'heavy' 
        ? ImpactStyle.Heavy 
        : style === 'light' 
        ? ImpactStyle.Light 
        : ImpactStyle.Medium,
    });
    return;
  }
  
  // Web fallback using Vibration API
  if ('vibrate' in navigator) {
    const duration = style === 'heavy' ? 50 : style === 'medium' ? 30 : 10;
    navigator.vibrate(duration);
  }
}

/**
 * Trigger notification haptic feedback
 */
export async function notification(type: HapticNotificationType = 'success'): Promise<void> {
  const Haptics = await getCapacitorHaptics();
  
  if (Haptics) {
    const { NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({
      type: type === 'success' 
        ? NotificationType.Success 
        : type === 'warning'
        ? NotificationType.Warning
        : NotificationType.Error,
    });
    return;
  }
  
  // Web fallback
  if ('vibrate' in navigator) {
    const pattern = type === 'success' ? [30] : type === 'warning' ? [30, 50, 30] : [50, 30, 50];
    navigator.vibrate(pattern);
  }
}

/**
 * Trigger selection changed haptic feedback
 */
export async function selectionChanged(): Promise<void> {
  const Haptics = await getCapacitorHaptics();
  
  if (Haptics) {
    await Haptics.selectionChanged();
    return;
  }
  
  // Web fallback
  if ('vibrate' in navigator) {
    navigator.vibrate(5);
  }
}

/**
 * Trigger vibration
 */
export async function vibrate(duration: number = 300): Promise<void> {
  const Haptics = await getCapacitorHaptics();
  
  if (Haptics) {
    await Haptics.vibrate({ duration });
    return;
  }
  
  // Web fallback
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}
