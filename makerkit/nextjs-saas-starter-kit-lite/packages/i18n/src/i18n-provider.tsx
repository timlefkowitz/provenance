'use client';

import type { InitOptions, i18n } from 'i18next';

import { initializeI18nClient } from './i18n.client';

let i18nInstance: i18n;
let i18nLoadingPromise: Promise<void> | null = null;

type Resolver = (
  lang: string,
  namespace: string,
) => Promise<Record<string, string>>;

export function I18nProvider({
  settings,
  children,
  resolver,
}: React.PropsWithChildren<{
  settings: InitOptions;
  resolver: Resolver;
}>) {
  useI18nClient(settings, resolver);

  return children;
}

/**
 * @name useI18nClient
 * @description A hook that initializes the i18n client.
 * @param settings
 * @param resolver
 */
function useI18nClient(settings: InitOptions, resolver: Resolver) {
  if (!i18nInstance || !hasMatchingSettings(i18nInstance, settings)) {
    i18nLoadingPromise ??= loadI18nInstance(settings, resolver).finally(() => {
      i18nLoadingPromise = null;
    });

    throw i18nLoadingPromise;
  }

  return i18nInstance;
}

async function loadI18nInstance(settings: InitOptions, resolver: Resolver) {
  i18nInstance = await initializeI18nClient(settings, resolver);
}

function normalizeLanguage(language: string | undefined) {
  return (language ?? '').trim().toLowerCase().split('-')[0];
}

function normalizeNamespaces(namespaces: InitOptions['ns']) {
  if (!namespaces) {
    return [];
  }

  const list = Array.isArray(namespaces) ? namespaces : [namespaces];

  return [...new Set(list.map((namespace) => String(namespace).trim()))].sort();
}

function hasMatchingSettings(instance: i18n, settings: InitOptions) {
  const instanceLanguage = normalizeLanguage(
    instance.resolvedLanguage ?? instance.language,
  );
  const settingsLanguage = normalizeLanguage(settings.lng as string | undefined);

  const instanceNamespaces = normalizeNamespaces(instance.options.ns);
  const settingsNamespaces = normalizeNamespaces(settings.ns);

  const hasSameLanguage = instanceLanguage === settingsLanguage;
  const hasSameNamespaces =
    instanceNamespaces.length === settingsNamespaces.length &&
    instanceNamespaces.every(
      (namespace, index) => namespace === settingsNamespaces[index],
    );

  return hasSameLanguage && hasSameNamespaces;
}
