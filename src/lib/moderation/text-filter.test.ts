import { describe, expect, it } from 'vitest';
import { containsObjectionableText } from './text-filter';

describe('containsObjectionableText', () => {
  it('allows ordinary art vocabulary', () => {
    expect(
      containsObjectionableText(
        'Reclining Nude',
        'Study of a breast, oil on linen',
        'Still Life with Dead Game',
        'The Killing of Holofernes',
        'Scunthorpe landscape',
        'Fagus sylvatica (beech)',
      ),
    ).toBe(false);
  });

  it('blocks slurs and explicit terms as whole words', () => {
    expect(containsObjectionableText('you are a faggot')).toBe(true);
    expect(containsObjectionableText('check my onlyfans')).toBe(true);
  });

  it('sees through common obfuscation', () => {
    expect(containsObjectionableText('p0rn')).toBe(true);
    expect(containsObjectionableText('k.y.s')).toBe(true);
    expect(containsObjectionableText('C-U-N-T')).toBe(true);
  });

  it('ignores empty fields', () => {
    expect(containsObjectionableText(null, undefined, '')).toBe(false);
  });
});
