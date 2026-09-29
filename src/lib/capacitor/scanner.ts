import { registerPlugin } from '@capacitor/core';

export type ScanResult =
  | { status: 'scanned'; value: string }
  | { status: 'cancelled' }
  | { status: 'denied' };

/** Native QR scanner (ios/App/CapApp-SPM/Sources/CapApp-SPM/ScannerPlugin.swift). */
export interface ScannerPlugin {
  scan(): Promise<ScanResult>;
}

export const Scanner = registerPlugin<ScannerPlugin>('Scanner');
