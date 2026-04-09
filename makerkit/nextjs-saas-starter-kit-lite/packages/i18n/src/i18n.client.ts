import i18next, { type InitOptions, i18n } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

let i18nPluginsRegistered = false;

/**
 * Initialize the i18n instance on the client.
 * @param settings - the i18n settings
 * @param resolver - a function that resolves the i18n resources
 */
export async function initializeI18nClient(
  settings: InitOptions,
  resolver: (lang: string, namespace: string) => Promise<object>,
): Promise<i18n> {
  if (!i18nPluginsRegistered) {
    i18next.use(
      resourcesToBackend(async (language, namespace, callback) => {
        try {
          const data = await resolver(language, namespace);
          return callback(null, data);
        } catch (error) {
          console.error('[I18n] Failed to resolve translation resource', error);
          return callback(error as Error, null);
        }
      }),
    );
    i18next.use(LanguageDetector).use(initReactI18next);
    i18nPluginsRegistered = true;
  }

  console.log('[I18n] Client init started');
  const namespaceList = normalizeNamespaces(settings.ns);
  const language = normalizeLanguage(settings.lng as string | undefined);

  const clientSettings: InitOptions = {
    ...settings,
    lng: language,
    detection: {
      order: ['cookie', 'htmlTag'],
      caches: ['cookie'],
      lookupCookie: 'lang',
    },
    interpolation: {
      escapeValue: false,
    },
  };

  if (!i18next.isInitialized) {
    await i18next.init(clientSettings, (err) => {
      if (err) {
        console.error('[I18n] Error initializing i18n client', err);
      }
    });
    console.log('[I18n] Client initialized');
  } else {
    if (language && i18next.resolvedLanguage !== language) {
      await i18next.changeLanguage(language);
    }
    console.log('[I18n] Reusing existing client instance');
  }

  if (namespaceList.length > 0) {
    await i18next.loadNamespaces(namespaceList);
  }

  console.log('[I18n] Client namespaces ensured');
  return i18next;
}

function normalizeLanguage(language: string | undefined) {
  return (language ?? 'en').trim().toLowerCase().split('-')[0];
}

function normalizeNamespaces(namespaces: InitOptions['ns']) {
  if (!namespaces) {
    return [];
  }

  const list = Array.isArray(namespaces) ? namespaces : [namespaces];

  return [...new Set(list.map((namespace) => String(namespace).trim()))];
}
