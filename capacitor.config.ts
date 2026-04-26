import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.provenance.app',
  appName: 'Provenance',
  webDir: 'out',
  server: {
    // For development, you can point to your local dev server
    // url: 'http://localhost:3000',
    // cleartext: true,
    
    // For production, we use the bundled web assets
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true,
    scrollEnabled: true,
    backgroundColor: '#F5F1E8',
    preferredContentMode: 'mobile',
    // Enable WebView debugging in development
    // webContentsDebuggingEnabled: true,
  },
  plugins: {
    // Push Notifications configuration
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Camera configuration
    Camera: {
      // iOS Camera permissions are handled in Info.plist
    },
    // Splash Screen configuration
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#F5F1E8',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#4A2F25',
    },
    // Status Bar configuration
    StatusBar: {
      style: 'dark',
      backgroundColor: '#F5F1E8',
    },
    // Keyboard configuration for better mobile input handling
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    // Local Notifications for offline reminders
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#4A2F25',
    },
  },
};

export default config;
