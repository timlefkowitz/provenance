'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { InstallPrompt } from './install-prompt';
import { MobileTabBar } from './mobile-tab-bar';
import { OfflineIndicator } from './offline-indicator';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAContextType {
  isInstalled: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  canInstall: boolean;
  isOnline: boolean;
  installApp: () => Promise<void>;
  swRegistration: ServiceWorkerRegistration | null;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Detect iOS
  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(isIOSDevice);
  }, []);

  // Detect standalone mode
  useEffect(() => {
    const standalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as Navigator & { standalone: boolean }).standalone) ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(standalone);
    setIsInstalled(standalone);
  }, []);

  // Track online status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          setSwRegistration(registration);
          console.log('[PWA] Service Worker registered:', registration.scope);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content available, show update prompt
                  console.log('[PWA] New content available');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    }
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show install prompt after a delay (if not already installed)
      const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
      if (!hasSeenPrompt && !isStandalone) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 5000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      console.log('[PWA] App installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      console.log('[PWA] No installation prompt available');
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('[PWA] Installation failed:', error);
    }
  }, [deferredPrompt]);

  const handleClosePrompt = useCallback(() => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
  }, []);

  const canInstall = !!deferredPrompt || (isIOS && !isStandalone);

  return (
    <PWAContext.Provider
      value={{
        isInstalled,
        isStandalone,
        isIOS,
        canInstall,
        isOnline,
        installApp,
        swRegistration,
      }}
    >
      <OfflineIndicator />
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      <MobileTabBar />
      {showInstallPrompt && !isStandalone && (
        <InstallPrompt
          isIOS={isIOS}
          onInstall={installApp}
          onClose={handleClosePrompt}
        />
      )}
    </PWAContext.Provider>
  );
}
