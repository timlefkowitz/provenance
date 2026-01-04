export async function i18nResolver(language: string, namespace: string) {
  const data = await import(
    `../../../public/locales/${language}/${namespace}.json`
  );

  return data as Record<string, string>;
}

