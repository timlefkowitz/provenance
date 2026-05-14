import { describe, expect, it } from 'vitest';

import { MAX_AUDIO_UPLOAD_BYTES } from './constants';
import { resolveInputExtension, validateAudioUpload } from './validation';

describe('validateAudioUpload', () => {
  it('accepts a small m4a with audio/mp4', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'memo.m4a', { type: 'audio/mp4' });
    const r = validateAudioUpload(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.inputExtension).toBe('.m4a');
      expect(r.sizeBytes).toBe(3);
    }
  });

  it('accepts application/octet-stream when extension is allowed', () => {
    const file = new File([new Uint8Array([9])], 'export.m4a', { type: 'application/octet-stream' });
    const r = validateAudioUpload(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.inputExtension).toBe('.m4a');
  });

  it('rejects empty file', () => {
    const file = new File([], 'empty.m4a', { type: 'audio/mp4' });
    const r = validateAudioUpload(file);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/empty/i);
    }
  });

  it('rejects unknown mime with bad extension', () => {
    const file = new File([new Uint8Array([1])], 'notes.exe', { type: 'application/x-msdownload' });
    const r = validateAudioUpload(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('rejects when size exceeds limit', () => {
    const file = new File([new Uint8Array([1])], 'big.m4a', { type: 'audio/mp4' });
    Object.defineProperty(file, 'size', { value: MAX_AUDIO_UPLOAD_BYTES + 1, configurable: true });
    const r = validateAudioUpload(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });
});

describe('resolveInputExtension', () => {
  it('maps wav mime when name has no extension', () => {
    expect(resolveInputExtension('recording', 'audio/wav')).toBe('.wav');
  });
});
