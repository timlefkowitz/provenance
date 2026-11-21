import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeNfcWriteResult =
  | { status: 'written'; locked: boolean }
  | { status: 'cancelled' };

/** Core NFC tag writer (ios/App/CapApp-SPM/Sources/CapApp-SPM/NfcPlugin.swift). */
export interface NfcPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  writeUrl(options: { url: string; lock?: boolean; prompt?: string }): Promise<NativeNfcWriteResult>;
}

export const NativeNfc = registerPlugin<NfcPlugin>('Nfc');

/** True in app builds that ship NfcPlugin. Older installs load the same web code. */
export function hasNativeNfcPlugin(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Nfc');
  } catch {
    return false;
  }
}
