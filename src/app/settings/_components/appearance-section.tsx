'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';
import { Sun, Computer, Check, BookOpen, ChevronDown, RotateCcw } from 'lucide-react';
import { languages, I18N_COOKIE_NAME } from '~/lib/i18n/i18n.settings';
import featuresFlagConfig from '~/config/feature-flags.config';
import {
  type DarkThemeColors,
  DARK_THEME_DEFAULTS,
  readDarkThemeColors,
  saveDarkThemeColors,
  resetDarkThemeColors,
} from '~/lib/dark-theme-colors';

const THEMES = [
  { value: 'parchment', label: 'Parchment', icon: BookOpen },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Computer },
] as const;

const COLOR_FIELDS: {
  key: keyof DarkThemeColors;
  label: string;
  description: string;
}[] = [
  {
    key: 'accent',
    label: 'Accent',
    description: 'Logo, headings, CTA buttons, link highlights',
  },
  {
    key: 'body',
    label: 'Body text',
    description: 'Paragraphs, nav links, secondary labels',
  },
  {
    key: 'surface',
    label: 'Surface',
    description: 'Nav bar, cards, elevated panels',
  },
  {
    key: 'canvas',
    label: 'Canvas',
    description: 'Deepest page background',
  },
];

function capitalize(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

// ─── Mini live preview ──────────────────────────────────────────────────────

function DarkPreview({ colors }: { colors: DarkThemeColors }) {
  const { accent, body, surface, canvas } = colors;
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: `${accent}30`, backgroundColor: canvas }}
    >
      {/* Mock nav bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: surface, borderBottom: `1px solid ${accent}20` }}
      >
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: accent }}>
          PROVENANCE
        </span>
        <div className="flex items-center gap-3">
          {['Artworks', 'Artists', 'Collection'].map((l) => (
            <span key={l} className="text-[10px]" style={{ color: `${body}99` }}>
              {l}
            </span>
          ))}
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: accent, color: canvas }}
          >
            Add Artwork
          </span>
        </div>
      </div>

      {/* Mock page body */}
      <div className="p-5 space-y-3">
        <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: accent }}>
          YOUR COLLECTION
        </p>
        <p className="text-base font-bold" style={{ color: body }}>
          I Have Faith in Nights
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: `${body}80` }}>
          Certificate of Authenticity · Lauren Raye Snow · Apr 15, 2026
        </p>

        {/* Mock card */}
        <div
          className="mt-1 rounded-lg p-3 space-y-2"
          style={{ backgroundColor: surface, border: `1px solid ${accent}20` }}
        >
          <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: `${body}60` }}>
            PROV-QTJ8OQ9Y
          </p>
          <div className="flex gap-2">
            <span
              className="rounded px-2 py-1 text-[10px] font-semibold"
              style={{ backgroundColor: accent, color: canvas }}
            >
              Complete certificate
            </span>
            <span
              className="rounded border px-2 py-1 text-[10px]"
              style={{ borderColor: `${accent}40`, color: accent }}
            >
              Preview
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Single color swatch + picker ───────────────────────────────────────────

function ColorField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(value);

  useEffect(() => {
    setHex(value);
  }, [value]);

  const commitHex = (raw: string) => {
    const clean = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      onChange(clean);
    }
  };

  return (
    <div className="flex items-start gap-3">
      {/* Color swatch — clicking opens native picker */}
      <button
        type="button"
        title={`Pick ${label} color`}
        onClick={() => inputRef.current?.click()}
        className="mt-0.5 h-8 w-8 shrink-0 rounded-md border-2 cursor-pointer transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: value, borderColor: `${value}60` }}
      />
      {/* Hidden native color picker */}
      <input
        ref={inputRef}
        type="color"
        value={value}
        className="sr-only"
        onChange={(e) => {
          setHex(e.target.value);
          onChange(e.target.value);
        }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {label}
          </span>
          {/* Hex text input */}
          <input
            type="text"
            value={hex}
            maxLength={7}
            spellCheck={false}
            className="w-20 rounded border px-2 py-0.5 font-mono text-xs focus:outline-none focus:ring-1"
            style={{
              backgroundColor: 'var(--muted)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              ['--tw-ring-color' as string]: 'var(--ring)',
            }}
            onChange={(e) => setHex(e.target.value)}
            onBlur={(e) => commitHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHex((e.target as HTMLInputElement).value);
            }}
          />
        </div>
        <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── Expandable customizer ───────────────────────────────────────────────────

function SystemColorCustomizer() {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<DarkThemeColors>(DARK_THEME_DEFAULTS);
  const isDefault =
    colors.accent  === DARK_THEME_DEFAULTS.accent  &&
    colors.body    === DARK_THEME_DEFAULTS.body    &&
    colors.surface === DARK_THEME_DEFAULTS.surface &&
    colors.canvas  === DARK_THEME_DEFAULTS.canvas;

  // Load saved colors on mount
  useEffect(() => {
    setColors(readDarkThemeColors());
  }, []);

  const handleChange = (key: keyof DarkThemeColors, value: string) => {
    const next = { ...colors, [key]: value };
    setColors(next);
    saveDarkThemeColors(next);
  };

  const handleReset = () => {
    resetDarkThemeColors();
    setColors(DARK_THEME_DEFAULTS);
  };

  return (
    <div className="mt-3 rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Toggle row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--muted)]"
      >
        <div className="flex items-center gap-2.5">
          {/* Four tiny swatches showing current colors */}
          <div className="flex gap-1">
            {[colors.accent, colors.body, colors.surface, colors.canvas].map((c, i) => (
              <span
                key={i}
                className="inline-block h-3 w-3 rounded-full border"
                style={{ backgroundColor: c, borderColor: `${c}60` }}
              />
            ))}
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
            Customize system colors
          </span>
          {!isDefault && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              Modified
            </span>
          )}
        </div>
        <ChevronDown
          className="h-4 w-4 transition-transform duration-200"
          style={{
            color: 'var(--muted-foreground)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Expandable body */}
      {open && (
        <div
          className="border-t p-4 space-y-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
        >
          {/* Live preview */}
          <DarkPreview colors={colors} />

          {/* Color fields */}
          <div className="space-y-4">
            {COLOR_FIELDS.map(({ key, label, description }) => (
              <ColorField
                key={key}
                label={label}
                description={description}
                value={colors[key]}
                onChange={(v) => handleChange(key, v)}
              />
            ))}
          </div>

          {/* Reset */}
          {!isDefault && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Tokyo Night defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main section ────────────────────────────────────────────────────────────

export function AppearanceSection() {
  const { setTheme, theme } = useTheme();
  const { i18n } = useTranslation();

  const languageNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'language' }),
    [i18n.language],
  );

  const languageChanged = useCallback(
    async (locale: string) => {
      if (locale === i18n.language) return;
      await i18n.changeLanguage(locale);
      document.cookie = `${I18N_COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      if (document.documentElement) {
        document.documentElement.lang = locale;
      }
      window.location.reload();
    },
    [i18n],
  );

  function setCookieTheme(t: string) {
    document.cookie = `theme=${t}; path=/; max-age=31536000`;
  }

  return (
    <section id="appearance" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">Appearance</h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Customize theme and language preferences.
        </p>
      </div>

      {/* Theme */}
      {featuresFlagConfig.enableThemeToggle && (
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-wine">Theme</CardTitle>
            <CardDescription className="font-serif">
              Choose between parchment, light, or follow your system preference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map(({ value, label, icon: Icon }) => {
                const isSelected = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setTheme(value);
                      setCookieTheme(value);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-4 font-serif text-sm transition-colors',
                      isSelected
                        ? 'border-wine bg-wine/10 text-wine'
                        : 'border-wine/15 text-ink/70 hover:border-wine/40 hover:bg-wine/5',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>

            {/* System color customizer — only visible when System is active */}
            {theme === 'system' && <SystemColorCustomizer />}
          </CardContent>
        </Card>
      )}

      {/* Language */}
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-wine">Language</CardTitle>
          <CardDescription className="font-serif">
            Choose your preferred language. The page will reload after switching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {languages.map((locale) => {
              const isSelected = locale === i18n.language;
              const label = capitalize(languageNames.of(locale) || locale);
              return (
                <button
                  key={locale}
                  type="button"
                  onClick={() => void languageChanged(locale)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border-2 px-4 py-3 font-serif text-sm transition-colors',
                    isSelected
                      ? 'border-wine bg-wine/10 text-wine font-medium'
                      : 'border-wine/15 text-ink/70 hover:border-wine/40 hover:bg-wine/5',
                  )}
                >
                  {label}
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
