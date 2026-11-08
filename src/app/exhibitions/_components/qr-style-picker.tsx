'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import { artFromImage, artFromWords } from '../_helpers/qr-art-client';
import { QR_LOGO_DATA_URI } from '../_helpers/qr-logo';
import {
  cleanQrWords,
  composeStyledQr,
  DEFAULT_QR_WORDS,
  MAX_QR_WORDS,
  QR_STYLES,
  QR_WORD_COLOURS,
  type QrStyleId,
  type QrStyleSettings,
} from '../_helpers/qr-style';

/** Uploaded images are cropped square and shrunk to this before saving. */
const UPLOAD_SIZE = 160;
const UPLOAD_MAX_CHARS = 60_000;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

/** Crops an uploaded image to a centred square and shrinks it to a small data URI. */
async function prepareUpload(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = UPLOAD_SIZE;
    canvas.height = UPLOAD_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, UPLOAD_SIZE, UPLOAD_SIZE);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      UPLOAD_SIZE,
      UPLOAD_SIZE,
    );
    const png = canvas.toDataURL('image/png');
    if (png.length <= UPLOAD_MAX_CHARS) return png;
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * QR style picker: plain, Photon Labs, Provenance wordmark, neon, an uploaded
 * image, picture or words drawn by the dots, or sun & grass. `baseSvg` is a
 * qrcode.react SVG drawn with level "H", no margin, black on white.
 */
export function QrStylePicker({
  baseSvg,
  qrStyle,
  onQrStyleChange,
  logTag = '[QR]',
}: {
  baseSvg: string;
  qrStyle: QrStyleSettings;
  onQrStyleChange: (next: QrStyleSettings) => void;
  logTag?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Art for "Picture in code" / "Words in code" before one is saved, so the
  // picker can preview them: the uploaded image (or Photon Labs) and the words.
  const wordsColour = qrStyle.wordsColour ?? QR_WORD_COLOURS[0].id;
  const [wordsDraft, setWordsDraft] = useState(qrStyle.words ?? DEFAULT_QR_WORDS);
  const [previewPicture, setPreviewPicture] = useState<string | null>(null);
  const [previewWords, setPreviewWords] = useState<string | null>(null);
  const pictureArt = qrStyle.pictureArt ?? previewPicture;
  const wordsArt = qrStyle.wordsArt ?? previewWords;

  useEffect(() => {
    if (qrStyle.pictureArt) return;
    let cancelled = false;
    artFromImage(qrStyle.customImage ?? QR_LOGO_DATA_URI)
      .then((art) => !cancelled && setPreviewPicture(art))
      .catch((err) => console.error(`${logTag} QR picture art failed`, err));
    return () => {
      cancelled = true;
    };
  }, [qrStyle.pictureArt, qrStyle.customImage, logTag]);

  useEffect(() => {
    if (qrStyle.wordsArt) return;
    let cancelled = false;
    artFromWords(qrStyle.words ?? DEFAULT_QR_WORDS, wordsColour)
      .then((art) => !cancelled && setPreviewWords(art))
      .catch((err) => console.error(`${logTag} QR words art failed`, err));
    return () => {
      cancelled = true;
    };
  }, [qrStyle.wordsArt, qrStyle.words, wordsColour, logTag]);

  // Typing redraws the words after a short pause, then saves.
  const wordsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (wordsTimer.current) clearTimeout(wordsTimer.current);
  }, []);

  const saveWords = async (text: string, colour: string) => {
    const words = cleanQrWords(text);
    if (!words) return;
    try {
      const art = await artFromWords(words, colour);
      onQrStyleChange({ ...qrStyle, style: 'words', words, wordsColour: colour, wordsArt: art });
    } catch (err) {
      console.error(`${logTag} QR words art failed`, err);
      toast.error('Could not draw those words.');
    }
  };

  const handleWordsInput = (text: string) => {
    setWordsDraft(text);
    if (wordsTimer.current) clearTimeout(wordsTimer.current);
    wordsTimer.current = setTimeout(() => void saveWords(text, wordsColour), 600);
  };

  const styled = (style: QrStyleId) =>
    composeStyledQr(baseSvg, { ...qrStyle, style, pictureArt, wordsArt });

  const selectStyle = (style: QrStyleId) => {
    if (style === 'custom' && !qrStyle.customImage) {
      fileRef.current?.click();
      return;
    }
    if (style === 'picture') {
      if (!pictureArt) return; // still drawing
      onQrStyleChange({ ...qrStyle, style, pictureArt });
      return;
    }
    if (style === 'words') {
      if (!wordsArt) return;
      onQrStyleChange({
        ...qrStyle,
        style,
        words: qrStyle.words ?? DEFAULT_QR_WORDS,
        wordsColour,
        wordsArt,
      });
      return;
    }
    onQrStyleChange({ ...qrStyle, style });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    setUploading(true);
    try {
      const customImage = await prepareUpload(file);
      const art = await artFromImage(customImage);
      console.log(`${logTag} QR image prepared`, { chars: customImage.length });
      // Uploading while "Picture in code" is chosen keeps that style with the new picture.
      onQrStyleChange({
        ...qrStyle,
        style: qrStyle.style === 'picture' ? 'picture' : 'custom',
        customImage,
        pictureArt: art,
      });
    } catch (err) {
      console.error(`${logTag} QR image upload failed`, err);
      toast.error('Could not use that image. Try a PNG or JPEG.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
  <fieldset>
    <legend className="mb-2 text-[10px] uppercase tracking-widest text-ink/40 font-serif">Style</legend>
    <div className="grid grid-cols-4 gap-2">
      {QR_STYLES.map((s) => {
        const active = qrStyle.style === s.id;
        const needsUpload = s.id === 'custom' && !qrStyle.customImage;
        const drawing = (s.id === 'picture' && !pictureArt) || (s.id === 'words' && !wordsArt);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => selectStyle(s.id)}
            aria-pressed={active}
            title={s.hint}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border p-1.5 text-[11px] font-serif leading-tight transition-colors',
              active ? 'border-wine bg-wine/10 text-wine' : 'border-wine/20 text-ink/60 hover:border-wine/40',
            )}
          >
            {needsUpload || drawing ? (
              <span
                aria-hidden="true"
                className="flex aspect-square w-full items-center justify-center rounded-sm bg-parchment text-ink/40"
              >
                {needsUpload ? <ImagePlus className="h-5 w-5" /> : null}
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="block aspect-square w-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: baseSvg ? styled(s.id) : '' }}
              />
            )}
            {s.label}
          </button>
        );
      })}
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-serif text-ink/45">
      <button
        type="button"
        className="underline hover:text-ink disabled:opacity-50"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Preparing image…' : qrStyle.customImage ? 'Upload a different image' : 'Upload an image'}
      </button>
      {qrStyle.style === 'neon' && (
        <span>Light on dark: phone cameras read it; some older scanner apps may not.</span>
      )}
      {qrStyle.style === 'picture' && (
        <span>
          {qrStyle.customImage ? 'Drawn from your image.' : 'Drawn from the Photon Labs image. Upload to use your own.'}
        </span>
      )}
    </div>
    {qrStyle.style === 'words' && (
      <div className="mt-3 space-y-2">
        <label className="block text-[11px] font-serif text-ink/60">
          Words
          <input
            type="text"
            value={wordsDraft}
            maxLength={MAX_QR_WORDS}
            onChange={(e) => handleWordsInput(e.target.value)}
            className="mt-1 block w-full rounded-md border border-wine/20 bg-white px-2 py-1.5 font-serif text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/30"
            placeholder="Gallery or show name"
          />
        </label>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Letter colour">
          {QR_WORD_COLOURS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={wordsColour === c.id}
              aria-label={c.label}
              title={c.label}
              onClick={() => void saveWords(wordsDraft, c.id)}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform',
                wordsColour === c.id ? 'scale-110 border-ink' : 'border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]',
              )}
              style={{ backgroundColor: c.id }}
            />
          ))}
        </div>
        <p className="text-[11px] font-serif text-ink/45">
          Short words show best. The code stays readable whatever you type.
        </p>
      </div>
    )}
    <input
      ref={fileRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="hidden"
      onChange={(e) => void handleUpload(e.target.files?.[0])}
    />
  </fieldset>
  );
}
