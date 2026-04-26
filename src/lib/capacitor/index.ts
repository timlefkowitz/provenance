/**
 * Capacitor Native Bridge
 * 
 * This module provides a unified interface for native iOS features.
 * It automatically detects whether we're running in Capacitor (native app)
 * or in a regular browser and provides appropriate fallbacks.
 */

// Check if running in Capacitor native environment
export const isNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
};

export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return capacitor?.getPlatform?.() === 'ios';
};

export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return capacitor?.getPlatform?.() === 'android';
};
