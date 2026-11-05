import { describe, expect, it } from 'vitest';

import { QR_LOGO_DATA_URI } from './qr-logo';
import {
  DEFAULT_QR_STYLE,
  centreImagePlacement,
  composeStyledQr,
  isQrImageDataUri,
  readQrStyle,
} from './qr-style';

// Minimal stand-in for qrcode.react's output (level H, no margin, 21 modules).
const BASE =
  '<svg height="512" width="512" viewBox="0 0 21 21" role="img"><path fill="#FFFFFF" d="M0,0 h21v21H0z" shape-rendering="crispEdges"></path><path fill="#000000" d="M0 0h7v7H0z" shape-rendering="crispEdges"></path></svg>';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('readQrStyle', () => {
  it('defaults to plain when nothing is saved or the value is unknown', () => {
    expect(readQrStyle(undefined)).toEqual(DEFAULT_QR_STYLE);
    expect(readQrStyle({ qr: { style: 'sparkles' } })).toEqual(DEFAULT_QR_STYLE);
  });

  it('reads a saved style and image', () => {
    expect(readQrStyle({ curator: 'x', qr: { style: 'neon', customImage: null } })).toEqual({
      style: 'neon',
      customImage: null,
    });
    expect(readQrStyle({ qr: { style: 'custom', customImage: PNG } })).toEqual({
      style: 'custom',
      customImage: PNG,
    });
  });

  it('falls back to plain for a custom style whose image is missing or invalid', () => {
    expect(readQrStyle({ qr: { style: 'custom', customImage: 'javascript:alert(1)' } })).toEqual(
      DEFAULT_QR_STYLE,
    );
  });
});

describe('isQrImageDataUri', () => {
  it('accepts small base64 PNG/JPEG/WebP and rejects anything else', () => {
    expect(isQrImageDataUri(PNG)).toBe(true);
    expect(isQrImageDataUri('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isQrImageDataUri('https://example.com/logo.png')).toBe(false);
    expect(isQrImageDataUri(`data:image/png;base64,${'A'.repeat(90_000)}`)).toBe(false);
  });
});

describe('composeStyledQr', () => {
  it('keeps the plain code black on white with a quiet zone', () => {
    const svg = composeStyledQr(BASE, DEFAULT_QR_STYLE);
    expect(svg).toContain('viewBox="0 0 25 25"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).not.toContain('<image');
  });

  it('places the Photon Labs image in the centre, or leaves it for the canvas', () => {
    const svg = composeStyledQr(BASE, { style: 'photon', customImage: null });
    expect(svg).toContain(`href="${QR_LOGO_DATA_URI}"`);
    expect(composeStyledQr(BASE, { style: 'photon', customImage: null }, { omitImages: true })).not.toContain(
      '<image',
    );
    const at = centreImagePlacement(BASE, { style: 'photon', customImage: null });
    expect(at?.total).toBe(25);
    expect(at && at.x + at.size / 2).toBeCloseTo(12.5);
  });

  it('uses the uploaded image for the custom style', () => {
    expect(composeStyledQr(BASE, { style: 'custom', customImage: PNG })).toContain(`href="${PNG}"`);
  });

  it('letters the wordmark without an image', () => {
    const svg = composeStyledQr(BASE, { style: 'wordmark', customImage: PNG });
    expect(svg).toContain('>provenance</text>');
    expect(svg).not.toContain('<image');
  });

  it('draws neon as light modules on dark, framed, with a wide quiet zone', () => {
    const svg = composeStyledQr(BASE, { style: 'neon', customImage: null });
    expect(svg).toContain('fill="#242400"');
    expect(svg).toContain('fill="#8cf0e6" filter="url(#pv-qr-glow)"');
    expect(svg).not.toContain('fill="#000000"');
    expect(svg.match(/stroke="#8cf0e6"/g)).toHaveLength(3);
    expect(svg).toContain('translate(7.5 7.5)');
  });
});
