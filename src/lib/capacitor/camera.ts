/**
 * Native Camera Service for Capacitor
 * 
 * Provides native camera access on iOS with fallback to web APIs.
 */

import { isNative } from './index';

export interface CapturedPhoto {
  dataUrl: string;
  format: string;
  timestamp: number;
}

export interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: 'dataUrl' | 'uri' | 'base64';
  source?: 'camera' | 'photos' | 'prompt';
  direction?: 'rear' | 'front';
  presentationStyle?: 'fullscreen' | 'popover';
  width?: number;
  height?: number;
}

// Lazy load Capacitor Camera plugin
const getCapacitorCamera = async () => {
  if (!isNative()) return null;
  try {
    const { Camera } = await import('@capacitor/camera');
    return Camera;
  } catch {
    console.warn('Capacitor Camera plugin not available');
    return null;
  }
};

/**
 * Check camera permissions
 */
export async function checkCameraPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
  const Camera = await getCapacitorCamera();
  
  if (Camera) {
    const permissions = await Camera.checkPermissions();
    return permissions.camera;
  }
  
  // Web fallback
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'prompt';
  }
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
  const Camera = await getCapacitorCamera();
  
  if (Camera) {
    const permissions = await Camera.requestPermissions();
    return permissions.camera;
  }
  
  // Web fallback - try to access camera to trigger permission prompt
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

/**
 * Take a photo using the native camera or web fallback
 */
export async function takePhoto(options: CameraOptions = {}): Promise<CapturedPhoto | null> {
  const Camera = await getCapacitorCamera();
  
  if (Camera) {
    const { CameraResultType, CameraSource, CameraDirection } = await import('@capacitor/camera');
    
    try {
      const photo = await Camera.getPhoto({
        quality: options.quality ?? 90,
        allowEditing: options.allowEditing ?? false,
        resultType: options.resultType === 'uri' 
          ? CameraResultType.Uri 
          : options.resultType === 'base64'
          ? CameraResultType.Base64
          : CameraResultType.DataUrl,
        source: options.source === 'photos' 
          ? CameraSource.Photos 
          : options.source === 'prompt'
          ? CameraSource.Prompt
          : CameraSource.Camera,
        direction: options.direction === 'front' 
          ? CameraDirection.Front 
          : CameraDirection.Rear,
        presentationStyle: options.presentationStyle === 'popover' ? 'popover' : 'fullScreen',
        width: options.width,
        height: options.height,
      });
      
      return {
        dataUrl: photo.dataUrl || `data:image/${photo.format};base64,${photo.base64String}`,
        format: photo.format,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  }
  
  // Web fallback - return null to trigger web camera UI
  return null;
}

/**
 * Pick photo from gallery
 */
export async function pickFromGallery(options: CameraOptions = {}): Promise<CapturedPhoto | null> {
  return takePhoto({ ...options, source: 'photos' });
}

/**
 * Pick multiple photos from gallery (iOS 14+)
 */
export async function pickMultiplePhotos(limit: number = 10): Promise<CapturedPhoto[]> {
  const Camera = await getCapacitorCamera();
  
  if (Camera) {
    const { CameraResultType } = await import('@capacitor/camera');
    
    try {
      const photos = await Camera.pickImages({
        quality: 90,
        limit,
      });
      
      return photos.photos.map(photo => ({
        dataUrl: photo.webPath || '',
        format: photo.format,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Gallery picker error:', error);
      return [];
    }
  }
  
  // Web fallback
  return [];
}
