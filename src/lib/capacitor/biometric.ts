import { registerPlugin } from '@capacitor/core';

export type BiometryType = 'faceID' | 'touchID' | 'opticID' | 'none';

/** Face ID / Touch ID with passcode fallback (ios/App/CapApp-SPM/Sources/CapApp-SPM/BiometricPlugin.swift). */
export interface BiometricPlugin {
  getStatus(): Promise<{ available: boolean; biometryType: BiometryType }>;
  authenticate(options: { reason: string }): Promise<{ success: boolean }>;
}

export const Biometric = registerPlugin<BiometricPlugin>('Biometric');

export function biometryLabel(type: BiometryType): string {
  switch (type) {
    case 'faceID':
      return 'Face ID';
    case 'touchID':
      return 'Touch ID';
    case 'opticID':
      return 'Optic ID';
    default:
      return 'your passcode';
  }
}
