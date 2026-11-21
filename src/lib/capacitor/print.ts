import { Capacitor, registerPlugin } from '@capacitor/core';

/** iOS print sheet for an HTML document (ios/App/CapApp-SPM/Sources/CapApp-SPM/PrintPlugin.swift). */
export interface PrintPlugin {
  printHtml(options: { html: string; baseUrl?: string; jobName?: string }): Promise<{ completed: boolean }>;
}

export const NativePrint = registerPlugin<PrintPlugin>('Print');

/** True in app builds that ship PrintPlugin. Older installs load the same web code. */
export function canPrintNatively(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Print');
  } catch {
    return false;
  }
}
