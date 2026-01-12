import { cache } from 'react';

import { cookies, headers } from 'next/headers';

import {
  initializeServerI18n,
  parseAcceptLanguageHeader,
} from '@kit/i18n/server';

import featuresFlagConfig from '~/config/feature-flags.config';
import {
  I18N_COOKIE_NAME,
  getI18nSettings,
  languages,
} from '~/lib/i18n/i18n.settings';

import { i18nResolver } from './i18n.resolver';

const priority = featuresFlagConfig.languagePriority;

async function createInstance() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(I18N_COOKIE_NAME)?.value;

  let selectedLanguage: string | undefined = undefined;

  if (cookie) {
    selectedLanguage = getLanguageOrFallback(cookie);
  }

  if (!selectedLanguage && priority === 'user') {
    const userPreferredLanguage = await getPreferredLanguageFromBrowser();

    selectedLanguage = getLanguageOrFallback(userPreferredLanguage);
  }

  // Default to 'en' if no language is selected
  if (!selectedLanguage) {
    selectedLanguage = 'en';
  }

  const settings = getI18nSettings(selectedLanguage);

  return initializeServerI18n(settings, i18nResolver);
}

export const createI18nServerInstance = cache(createInstance);

async function getPreferredLanguageFromBrowser() {
  const headersStore = await headers();
  const acceptLanguage = headersStore.get('accept-language');

  if (!acceptLanguage) {
    return;
  }

  return parseAcceptLanguageHeader(acceptLanguage, languages)[0];
}

function getLanguageOrFallback(language: string | undefined) {
  let selectedLanguage = language;

  if (!languages.includes(language ?? '')) {
    console.warn(
      `Language "${language}" is not supported. Falling back to "${languages[0]}"`,
    );

    selectedLanguage = languages[0];
  }

  return selectedLanguage;
}

