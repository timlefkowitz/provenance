import { describe, expect, it } from 'vitest';

import { formatPhone, normalizePhoneInput, phoneHref } from './phone';

describe('phone helpers', () => {
  it('formats a bare US number', () => {
    expect(formatPhone('2102027013')).toBe('(210) 202-7013');
    expect(formatPhone('1-210-202-7013')).toBe('(210) 202-7013');
    expect(formatPhone('+1 210 202 7013')).toBe('(210) 202-7013');
  });

  it('leaves international numbers as typed', () => {
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });

  it('builds tel links', () => {
    expect(phoneHref('(210) 202-7013')).toBe('tel:2102027013');
    expect(phoneHref('+44 20 7946 0958')).toBe('tel:+442079460958');
  });

  it('normalises input', () => {
    expect(normalizePhoneInput('  ')).toBeNull();
    expect(normalizePhoneInput(' 210-202-7013 ')).toBe('210-202-7013');
    expect(() => normalizePhoneInput('call me maybe')).toThrow();
    expect(() => normalizePhoneInput('123')).toThrow();
  });
});
