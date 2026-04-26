'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Camera, RotateCcw, Check, FlipHorizontal, Aperture } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { useCamera } from '~/hooks/use-camera';
import { cn } from '@kit/ui/utils';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  aspectRatio?: number;
}

export function CameraCapture({ onCapture, onClose, aspectRatio = 4 / 3 }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  
  const {
    isActive,
    isLoading,
    error,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
  } = useCamera({ facingMode: 'environment' });

  // Start camera on mount
  useEffect(() => {
    if (videoRef.current) {
      startCamera(videoRef.current);
    }

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = useCallback(async () => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    const blob = await capturePhoto();
    if (blob) {
      setCapturedBlob(blob);
      setPreview(URL.createObjectURL(blob));
    }
  }, [capturePhoto]);

  const handleRetake = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setCapturedBlob(null);
  }, [preview]);

  const handleConfirm = useCallback(() => {
    if (capturedBlob) {
      onCapture(capturedBlob);
      stopCamera();
    }
  }, [capturedBlob, onCapture, stopCamera]);

  const handleClose = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    stopCamera();
    onClose();
  }, [preview, stopCamera, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 pt-safe bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
          aria-label="Close camera"
        >
          <X className="w-5 h-5" />
        </button>
        
        {!preview && (
          <button
            onClick={switchCamera}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
            aria-label="Switch camera"
          >
            <FlipHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Camera view / Preview */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Flash overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-white z-20 pointer-events-none transition-opacity duration-150',
            isFlashing ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* Loading state */}
        {isLoading && !preview && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-white">
              <Aperture className="w-12 h-12 animate-pulse" />
              <p className="text-sm">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !preview && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center text-white space-y-4">
              <Camera className="w-16 h-16 mx-auto opacity-50" />
              <p className="text-lg">{error}</p>
              <Button
                onClick={() => videoRef.current && startCamera(videoRef.current)}
                variant="secondary"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Video preview */}
        {!preview && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'w-full h-full object-cover',
              (!isActive || isLoading) && 'opacity-0'
            )}
            style={{ aspectRatio }}
          />
        )}

        {/* Captured image preview */}
        {preview && (
          <img
            src={preview}
            alt="Captured photo"
            className="w-full h-full object-contain"
          />
        )}

        {/* Viewfinder grid overlay */}
        {!preview && isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full grid grid-cols-3 grid-rows-3">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border border-white/20" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 pb-safe bg-gradient-to-t from-black/80 to-transparent">
        <div className="p-6 flex items-center justify-center gap-8">
          {!preview ? (
            <>
              {/* Spacer */}
              <div className="w-14" />
              
              {/* Capture button */}
              <button
                onClick={handleCapture}
                disabled={!isActive || isLoading}
                className={cn(
                  'w-20 h-20 rounded-full border-4 border-white flex items-center justify-center',
                  'transition-all active:scale-95',
                  (!isActive || isLoading) && 'opacity-50'
                )}
                aria-label="Take photo"
              >
                <div className="w-16 h-16 rounded-full bg-white" />
              </button>
              
              {/* Spacer */}
              <div className="w-14" />
            </>
          ) : (
            <>
              {/* Retake button */}
              <button
                onClick={handleRetake}
                className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white"
                aria-label="Retake photo"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
              
              {/* Spacer */}
              <div className="w-20" />
              
              {/* Confirm button */}
              <button
                onClick={handleConfirm}
                className="w-14 h-14 rounded-full bg-wine flex items-center justify-center text-white"
                aria-label="Use this photo"
              >
                <Check className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
