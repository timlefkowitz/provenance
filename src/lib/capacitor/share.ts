import { isNativePlatform } from './is-native';

export type ShareLinkResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Opens the share sheet for a link: the native iOS sheet in the app,
 * navigator.share on the web, and copies the link where neither exists.
 */
export async function shareLink(options: { title?: string; text?: string; url: string }): Promise<ShareLinkResult> {
  try {
    if (isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ ...options, dialogTitle: options.title });
      return 'shared';
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share(options);
      return 'shared';
    }
    await navigator.clipboard.writeText(options.url);
    return 'copied';
  } catch (err) {
    const message = err instanceof Error ? `${err.name} ${err.message}` : String(err);
    if (/abort|cancel/i.test(message)) return 'cancelled';
    console.error('[Share] shareLink failed', err);
    return 'failed';
  }
}
