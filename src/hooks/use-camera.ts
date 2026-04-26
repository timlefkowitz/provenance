'use client';

import { useState, useCallback, useRef } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

interface CameraState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean | null;
}

export function useCamera(options: UseCameraOptions = {}) {
  const { facingMode = 'environment', width = 1920, height = 1080 } = options;
  
  const [state, setState] = useState<CameraState>({
    isActive: false,
    isLoading: false,
    error: null,
    hasPermission: null,
  });
  
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const checkPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setState(prev => ({ ...prev, hasPermission: result.state === 'granted' }));
      return result.state === 'granted';
    } catch {
      // Permissions API not supported, will need to request
      return null;
    }
  }, []);

  const startCamera = useCallback(async (videoElement?: HTMLVideoElement) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState(prev => ({
        ...prev,
        error: 'Camera not supported on this device',
        isLoading: false,
      }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoElement) {
        videoRef.current = videoElement;
        videoElement.srcObject = stream;
        await videoElement.play();
      }

      setState({
        isActive: true,
        isLoading: false,
        error: null,
        hasPermission: true,
      });

      return stream;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to access camera';
      const isPermissionDenied = errorMessage.includes('Permission denied') || 
                                  errorMessage.includes('NotAllowedError');
      
      setState({
        isActive: false,
        isLoading: false,
        error: isPermissionDenied ? 'Camera permission denied' : errorMessage,
        hasPermission: isPermissionDenied ? false : null,
      });
      
      return null;
    }
  }, [facingMode, width, height]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !streamRef.current) {
      setState(prev => ({ ...prev, error: 'Camera not active' }));
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(video, 0, 0);

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          0.92
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture photo';
      setState(prev => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    
    stopCamera();
    
    if (!navigator.mediaDevices?.getUserMedia) return null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState(prev => ({ ...prev, isActive: true }));
      return stream;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch camera';
      setState(prev => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, [facingMode, width, height, stopCamera]);

  return {
    ...state,
    stream: streamRef.current,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    checkPermission,
  };
}
