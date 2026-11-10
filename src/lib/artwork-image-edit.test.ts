import { describe, expect, it } from 'vitest';

import { nextArtworkImageColumns, straightenFillScale } from './artwork-image-edit';

const plain = { image_url: 'a.jpg', original_image_url: null };
const edited = { image_url: 'a-crop.jpg', original_image_url: 'a.jpg' };

describe('nextArtworkImageColumns', () => {
  it('a new photo becomes its own original', () => {
    expect(nextArtworkImageColumns(edited, { kind: 'replace', imageUrl: 'b.jpg' })).toEqual({
      image_url: 'b.jpg',
      original_image_url: null,
    });
  });

  it('first edit keeps the current photo as the original', () => {
    expect(nextArtworkImageColumns(plain, { kind: 'edit', imageUrl: 'a-crop.jpg' })).toEqual(edited);
  });

  it('re-editing keeps the first original, not the previous crop', () => {
    expect(nextArtworkImageColumns(edited, { kind: 'edit', imageUrl: 'a-crop2.jpg' })).toEqual({
      image_url: 'a-crop2.jpg',
      original_image_url: 'a.jpg',
    });
  });

  it('editing a just-picked photo keeps that upload as the original', () => {
    expect(
      nextArtworkImageColumns(edited, {
        kind: 'edit',
        imageUrl: 'b-crop.jpg',
        uploadedOriginalUrl: 'b.jpg',
      }),
    ).toEqual({ image_url: 'b-crop.jpg', original_image_url: 'b.jpg' });
  });

  it('restore puts the original back', () => {
    expect(nextArtworkImageColumns(edited, { kind: 'restore' })).toEqual(plain);
  });

  it('restore is a no-op without an original', () => {
    expect(nextArtworkImageColumns(plain, { kind: 'restore' })).toBeNull();
  });
});

describe('straightenFillScale', () => {
  it('is 1 when level', () => {
    expect(straightenFillScale(400, 300, 0)).toBeCloseTo(1);
  });

  it('shrinks so the rotated photo still covers the frame', () => {
    const w = 400;
    const h = 300;
    const deg = 10;
    const k = straightenFillScale(w, h, deg);
    expect(k).toBeLessThan(1);
    // The scaled frame, rotated back into the photo, must fit inside it.
    const rad = (deg * Math.PI) / 180;
    const fw = w * k;
    const fh = h * k;
    expect(fw * Math.cos(rad) + fh * Math.sin(rad)).toBeLessThanOrEqual(w + 1e-9);
    expect(fw * Math.sin(rad) + fh * Math.cos(rad)).toBeLessThanOrEqual(h + 1e-9);
  });

  it('is symmetric for negative angles', () => {
    expect(straightenFillScale(400, 300, -7)).toBeCloseTo(straightenFillScale(400, 300, 7));
  });
});
