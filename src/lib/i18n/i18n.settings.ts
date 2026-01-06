import { createI18nSettings } from '@kit/i18n';

const defaultLanguage = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en';

export const languages: string[] = [defaultLanguage];

export const I18N_COOKIE_NAME = 'lang';

export const defaultI18nNamespaces = [
  'common',
  'auth',
  'account',
  'teams',
  'billing',
  'marketing',
];

export function getI18nSettings(
  language: string | undefined,
  ns: string | string[] = defaultI18nNamespaces,
) {
  let lng = language ?? defaultLanguage;

  if (!languages.includes(lng)) {
    console.warn(
      `Language "${lng}" is not supported. Falling back to "${defaultLanguage}"`,
    );

    lng = defaultLanguage;
  }

  return createI18nSettings({
    language: lng,
    namespaces: ns,
    languages,
  });
}

