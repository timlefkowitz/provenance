#!/usr/bin/env tsx
/**
 * WCAG AA contrast checker for all email layout presets.
 *
 * Checks four critical text-on-background pairs per preset:
 *   1. body ink vs card background        (≥ 4.5:1 for normal text)
 *   2. accent/link color vs card bg       (≥ 4.5:1 — links in body)
 *   3. button label vs button fill        (≥ 4.5:1 — the most critical)
 *   4. masthead wordmark vs masthead bg   (≥ 4.5:1)
 *
 * Run: pnpm email:contrast
 * Exit 1 on any failure so this can gate CI.
 */

import { EMAIL_THEMES, EMAIL_LAYOUT_PRESET_IDS } from '../src/lib/email-layout-presets';

// ── WCAG relative luminance + contrast ratio ──────────────────────────────

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  // Handle non-hex values (e.g. 'rgba(...)', 'transparent') gracefully
  if (!hex.startsWith('#')) return 0;
  const [r, g, b] = parseHex(hex).map((v) => {
    const srgb = v / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Check all presets ──────────────────────────────────────────────────────

const PASS_THRESHOLD = 4.5;

interface CheckResult {
  preset:    string;
  pair:      string;
  fg:        string;
  bg:        string;
  ratio:     number;
  pass:      boolean;
}

const results: CheckResult[] = [];

for (const presetId of EMAIL_LAYOUT_PRESET_IDS) {
  const t = EMAIL_THEMES[presetId];

  // Masthead background varies by variant
  const mastheadBg = t.mastheadVariant === 'hero'
    ? (t.heroBandColor ?? t.parchment)
    : t.parchment;

  const mastheadFg = t.mastheadVariant === 'hero'
    ? (t.heroBandTextColor ?? '#FFFFFF')
    : t.wine;

  const checks: Array<[string, string, string]> = [
    ['body ink vs card bg',       t.ink,        t.cardBg],
    ['accent/link vs card bg',    t.wine,       t.cardBg],
    ['button label vs button bg', t.accentText, t.wine],
    ['masthead wordmark vs bg',   mastheadFg,   mastheadBg],
  ];

  for (const [pair, fg, bg] of checks) {
    const ratio = contrastRatio(fg, bg);
    results.push({
      preset: presetId,
      pair,
      fg,
      bg,
      ratio,
      pass: ratio >= PASS_THRESHOLD,
    });
  }
}

// ── Print table ────────────────────────────────────────────────────────────

const COL_PRESET = 12;
const COL_PAIR   = 30;
const COL_FG     = 10;
const COL_BG     = 10;
const COL_RATIO  = 7;

function pad(s: string, n: number) { return s.padEnd(n); }

const header = [
  pad('Preset', COL_PRESET),
  pad('Pair', COL_PAIR),
  pad('Fg', COL_FG),
  pad('Bg', COL_BG),
  pad('Ratio', COL_RATIO),
  'Pass',
].join('  ');

console.log('\n' + header);
console.log('─'.repeat(header.length));

for (const r of results) {
  const ratio  = r.ratio.toFixed(2) + ':1';
  const status = r.pass ? '✓' : '✗ FAIL';
  const line = [
    pad(r.preset, COL_PRESET),
    pad(r.pair,   COL_PAIR),
    pad(r.fg,     COL_FG),
    pad(r.bg,     COL_BG),
    pad(ratio,    COL_RATIO),
    status,
  ].join('  ');
  console.log(r.pass ? line : `\x1b[31m${line}\x1b[0m`);
}

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.\n`);

if (failures.length > 0) {
  console.error(`\x1b[31m${failures.length} WCAG AA contrast failure(s). Fix accentText/wine/ink values in email-layout-presets.ts.\x1b[0m\n`);
  process.exit(1);
} else {
  console.log('\x1b[32mAll contrast checks passed.\x1b[0m\n');
}
