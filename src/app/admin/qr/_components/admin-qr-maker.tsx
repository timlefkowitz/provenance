'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, RotateCcw, TriangleAlert } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import { QrStylePicker } from '~/app/exhibitions/_components/qr-style-picker';
import { deliverFile, renderStyledQrPng } from '~/app/exhibitions/_helpers/qr-export';
import { composeStyledQr, DEFAULT_QR_STYLE, type QrStyleSettings } from '~/app/exhibitions/_helpers/qr-style';
import { adminButtonPrimary, adminMonoLabel, adminPanel } from '../../_components/admin-dash-tokens';

/** Styles drawn in plain black on white, which can take custom colours. */
const RECOLOURABLE = new Set<QrStyleSettings['style']>(['plain', 'photon', 'wordmark', 'custom']);

const PNG_SIZES = [512, 1024, 2048, 4096] as const;

const DEFAULT_FG = '#000000';
const DEFAULT_BG = '#ffffff';

/** Adds https:// to a bare domain; leaves anything with a scheme (mailto:, tel:, …) alone. */
function normalise(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (/^[^\s/]+\.[^\s/]+/.test(value)) return `https://${value}`;
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function recolour(svg: string, fg: string, bg: string): string {
  return svg.replace(/fill="#000000"/gi, `fill="${fg}"`).replace(/fill="#FFFFFF"/gi, `fill="${bg}"`);
}

function fileBase(url: string): string {
  try {
    const u = new URL(url);
    const slug = `${u.hostname}${u.pathname}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `qr-${slug.slice(0, 60) || 'link'}`;
  } catch {
    return 'qr-code';
  }
}

export function AdminQrMaker() {
  const [input, setInput] = useState('https://www.provenance.guru');
  const [qrStyle, setQrStyle] = useState<QrStyleSettings>(DEFAULT_QR_STYLE);
  const [fg, setFg] = useState(DEFAULT_FG);
  const [bg, setBg] = useState(DEFAULT_BG);
  const [pngSize, setPngSize] = useState<(typeof PNG_SIZES)[number]>(1024);
  const [baseSvg, setBaseSvg] = useState('');
  const [copied, setCopied] = useState(false);

  const value = normalise(input);
  const canRecolour = RECOLOURABLE.has(qrStyle.style);
  const customColours = canRecolour && (fg !== DEFAULT_FG || bg !== DEFAULT_BG);
  const transform = (svg: string) => (customColours ? recolour(svg, fg, bg) : svg);
  const contrast = contrastRatio(fg, bg);
  const inverted = luminance(fg) > luminance(bg);
  const colourWarning = !customColours
    ? null
    : contrast < 3
      ? 'Low contrast — phones may not read this code.'
      : inverted
        ? 'Light dots on a dark background — some scanners can’t read inverted codes.'
        : null;
  const preview = baseSvg ? transform(composeStyledQr(baseSvg, qrStyle)) : '';
  const base = fileBase(value);

  const handlePng = async () => {
    if (!baseSvg) return;
    console.log('[AdminQR] download PNG', { style: qrStyle.style, size: pngSize, customColours });
    try {
      const blob = await renderStyledQrPng(baseSvg, qrStyle, { size: pngSize, transform });
      await deliverFile(new File([blob], `${base}.png`, { type: 'image/png' }));
    } catch (err) {
      console.error('[AdminQR] PNG export failed', err);
      toast.error('Could not create the image.');
    }
  };

  const handleSvg = () => {
    if (!baseSvg) return;
    console.log('[AdminQR] download SVG', { style: qrStyle.style, customColours });
    const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${transform(
      composeStyledQr(baseSvg, qrStyle, { pixelSize: 1024, title: `QR code for ${value}` }),
    )}`;
    void deliverFile(new File([markup], `${base}.svg`, { type: 'image/svg+xml' }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      {/* Controls */}
      <div className="flex min-w-0 flex-col gap-6">
        <section className={cn(adminPanel, 'p-5')}>
          <p className={cn(adminMonoLabel, 'mb-3')}>link</p>
          <input
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-sm border border-[#1793d1]/30 bg-[#0c0e12] px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#1793d1]/70 focus:outline-none"
          />
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            Any link (mailto: and tel: work too). Bare domains get https:// added. Shorter links make
            simpler codes that scan from further away.
          </p>
        </section>

        <section className={cn(adminPanel, 'p-5')}>
          <div className="mb-3 flex items-center justify-between">
            <p className={adminMonoLabel}>colours</p>
            {customColours && (
              <button
                type="button"
                onClick={() => {
                  setFg(DEFAULT_FG);
                  setBg(DEFAULT_BG);
                }}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-slate-300"
              >
                <RotateCcw className="h-3 w-3" /> reset
              </button>
            )}
          </div>
          {canRecolour ? (
            <div className="flex flex-wrap gap-6">
              {(
                [
                  ['dots', fg, setFg],
                  ['background', bg, setBg],
                ] as const
              ).map(([label, colour, set]) => (
                <label key={label} className="flex items-center gap-2 font-mono text-xs text-slate-300">
                  <input
                    type="color"
                    value={colour}
                    onChange={(e) => set(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded-sm border border-[#1793d1]/30 bg-transparent"
                  />
                  {label}
                  <span className="text-slate-500">{colour}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[11px] text-slate-500">
              This style sets its own colours. Pick “No image”, Photon Labs, Provenance or Your image to
              choose colours.
            </p>
          )}
          {colourWarning && (
            <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-amber-400">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {colourWarning} (contrast {contrast.toFixed(1)}:1)
            </p>
          )}
        </section>

        <section className={cn(adminPanel, 'p-3')}>
          {/* The picker is drawn for the light editorial dialogs. */}
          <div className="rounded-sm bg-[#f8f4f0] p-4 text-[#2a1d17]">
            <QrStylePicker baseSvg={baseSvg} qrStyle={qrStyle} onQrStyleChange={setQrStyle} logTag="[AdminQR]" />
          </div>
        </section>
      </div>

      {/* Preview + export */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <section className={cn(adminPanel, 'p-5')}>
          <p className={cn(adminMonoLabel, 'mb-3')}>preview</p>

          {/* Plain code (level H, no margin) every style is composed from. */}
          <div
            aria-hidden="true"
            className="hidden"
            ref={(el) => {
              const svg = el?.innerHTML ?? '';
              if (svg && svg !== baseSvg) setBaseSvg(svg);
            }}
          >
            {value && (
              <QRCodeSVG value={value} size={512} level="H" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
            )}
          </div>

          {value ? (
            <div
              className="mx-auto w-full max-w-[18rem] overflow-hidden rounded-sm bg-white [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
              role="img"
              aria-label={`QR code for ${value}`}
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          ) : (
            <div className="mx-auto flex aspect-square w-full max-w-[18rem] items-center justify-center rounded-sm border border-dashed border-[#1793d1]/30 font-mono text-xs text-slate-500">
              enter a link
            </div>
          )}
          {value && <p className="mt-3 break-all text-center font-mono text-[11px] text-slate-500">{value}</p>}
        </section>

        <section className={cn(adminPanel, 'flex flex-col gap-3 p-5')}>
          <p className={adminMonoLabel}>export</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="PNG size">
            {PNG_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={pngSize === s}
                onClick={() => setPngSize(s)}
                className={cn(
                  'rounded-sm border px-2 py-1 font-mono text-[11px]',
                  pngSize === s
                    ? 'border-[#1793d1]/70 bg-[#1793d1]/15 text-[#67d4ff]'
                    : 'border-[#1793d1]/20 text-slate-400 hover:text-slate-200',
                )}
              >
                {s}px
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handlePng()}
              disabled={!value || !baseSvg}
              className={cn(adminButtonPrimary, 'inline-flex items-center justify-center gap-1.5 py-2 disabled:opacity-40')}
            >
              <Download className="h-3.5 w-3.5" /> PNG
            </button>
            <button
              type="button"
              onClick={handleSvg}
              disabled={!value || !baseSvg}
              className={cn(adminButtonPrimary, 'inline-flex items-center justify-center gap-1.5 py-2 disabled:opacity-40')}
            >
              <Download className="h-3.5 w-3.5" /> SVG
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!value}
            className="inline-flex items-center justify-center gap-1.5 font-mono text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'copied' : 'copy link'}
          </button>
        </section>
      </aside>
    </div>
  );
}
