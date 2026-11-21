import { loadImage } from '../_components/qr-style-picker';
import { centreImagePlacement, composeStyledQr, type QrStyleSettings } from './qr-style';

/**
 * Hand a file to the user. On iOS (the native app and Safari) a plain
 * `<a download>` is unreliable, so prefer the share sheet when it accepts
 * files — that's where "Save Image" lives. Falls back to a download link.
 */
export async function deliverFile(file: File): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      console.error('[QR] share failed, falling back to download', err);
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders a styled QR SVG to a PNG blob. The centre image is drawn separately
 * so the canvas isn't tainted. `transform` runs on the composed SVG first
 * (e.g. recolouring).
 */
export async function renderStyledQrPng(
  baseSvg: string,
  settings: QrStyleSettings,
  options: { size?: number; transform?: (svg: string) => string } = {},
): Promise<Blob> {
  const size = options.size ?? 1024;
  const composed = composeStyledQr(baseSvg, settings, { pixelSize: size, omitImages: true });
  const svg = options.transform ? options.transform(composed) : composed;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(await loadImage(svgUrl), 0, 0, size, size);

    const placement = centreImagePlacement(baseSvg, settings);
    if (placement) {
      const k = size / placement.total;
      const img = await loadImage(placement.href);
      // Same "cover" crop as the SVG's preserveAspectRatio="xMidYMid slice".
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        placement.x * k,
        placement.y * k,
        placement.size * k,
        placement.size * k,
      );
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
