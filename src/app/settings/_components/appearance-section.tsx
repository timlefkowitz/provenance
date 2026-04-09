'use client';

import { useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';
import { Sun, Moon, Computer, Check } from 'lucide-react';
import { languages, I18N_COOKIE_NAME } from '~/lib/i18n/i18n.settings';
import featuresFlagConfig from '~/config/feature-flags.config';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Computer },
] as const;

function capitalize(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

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
              Choose between light mode, dark mode, or follow your system
              setting.
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
