'use client';

import { useCallback, useMemo } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@kit/ui/dropdown-menu';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';
import { languages } from '~/lib/i18n/i18n.settings';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { language: currentLanguage } = i18n;

  const languageNames = useMemo(() => {
    return new Intl.DisplayNames([currentLanguage], {
      type: 'language',
    });
  }, [currentLanguage]);

  const languageChanged = useCallback(
    async (locale: string) => {
      if (locale === currentLanguage) {
        return;
      }

      await i18n.changeLanguage(locale);
      
      // Set cookie for language preference
      document.cookie = `lang=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      
      // Refresh to apply language change
      window.location.reload();
    },
    [i18n, currentLanguage],
  );

  const getLanguageLabel = (locale: string) => {
    const name = languageNames.of(locale) || locale;
    return capitalize(name);
  };

  const MenuItems = useMemo(
    () =>
      languages.map((locale) => {
        const isSelected = locale === currentLanguage;

        return (
          <DropdownMenuItem
            className={cn('flex cursor-pointer items-center space-x-2', {
              'bg-muted': isSelected,
            })}
            key={locale}
            onClick={() => languageChanged(locale)}
          >
            <span className="flex items-center justify-between w-full">
              <span>{getLanguageLabel(locale)}</span>
              {isSelected && (
                <span className="ml-2 text-xs">✓</span>
              )}
            </span>
          </DropdownMenuItem>
        );
      }),
    [currentLanguage, languageNames, languageChanged],
  );

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className={
            'hidden w-full items-center justify-between gap-x-3 lg:flex'
          }
        >
          <span className={'flex space-x-2'}>
            <Languages className="h-4" />
            <span>
              <Trans i18nKey={'common:language'} defaults={'Language'} />
            </span>
          </span>
        </DropdownMenuSubTrigger>

        <DropdownMenuSubContent>{MenuItems}</DropdownMenuSubContent>
      </DropdownMenuSub>

      <div className={'lg:hidden'}>
        <DropdownMenuLabel>
          <Trans i18nKey={'common:language'} defaults={'Language'} />
        </DropdownMenuLabel>

        {MenuItems}
      </div>
    </>
  );
}

function capitalize(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

