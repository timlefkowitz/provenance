'use client';

import { useState } from 'react';
import { X, Share, Plus, Download, Smartphone } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

interface InstallPromptProps {
  isIOS: boolean;
  onInstall: () => Promise<void>;
  onClose: () => void;
}

export function InstallPrompt({ isIOS, onInstall, onClose }: InstallPromptProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  if (isIOS) {
    return (
      <div
        className={cn(
          'fixed bottom-0 inset-x-0 z-50 p-4 pb-safe transition-all duration-300',
          isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        )}
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-wine/10 flex items-center justify-center shrink-0">
                <Smartphone className="w-7 h-7 text-wine" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Add to Home Screen
                </h3>
                <p className="text-sm text-muted-foreground">
                  Install Provenance for the best experience
                </p>
              </div>
            </div>
          </div>

          {/* iOS Instructions */}
          <div className="px-6 pb-6 space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 text-sm font-medium">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-foreground">
                    Tap the <Share className="w-4 h-4 inline mx-1 text-blue-500" /> share button in Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 text-sm font-medium">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-foreground">
                    Scroll and tap <span className="inline-flex items-center gap-1 bg-background border border-border rounded px-2 py-0.5 text-sm"><Plus className="w-3 h-3" /> Add to Home Screen</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 text-sm font-medium">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-foreground">
                    Tap <span className="font-medium">Add</span> to install the app
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={handleClose}
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Android / Desktop prompt
  return (
    <div
      className={cn(
        'fixed bottom-0 inset-x-0 z-50 p-4 pb-safe transition-all duration-300',
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      )}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto">
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-wine/10 flex items-center justify-center shrink-0">
              <Download className="w-7 h-7 text-wine" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Install Provenance
              </h3>
              <p className="text-sm text-muted-foreground">
                Add to your home screen for quick access
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-3">
          <ul className="text-sm text-muted-foreground space-y-2 mb-4">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-wine" />
              Works offline with your collection
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-wine" />
              Push notifications for updates
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-wine" />
              Full-screen app experience
            </li>
          </ul>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
              className="flex-1"
            >
              Not Now
            </Button>
            <Button
              onClick={onInstall}
              className="flex-1 bg-wine hover:bg-wine/90 text-white"
            >
              Install App
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
