export async function i18nResolver(language: string, namespace: string) {
  try {
    // Try to load the translation file
    // Path from src/lib/i18n/ to public/locales/
    const data = await import(
      `../../../public/locales/${language}/${namespace}.json`
    );

    // Next.js JSON imports return the data directly, not as default
    return (data.default || data) as Record<string, string>;
  } catch (error) {
    console.error(
      `Failed to load translation file: locales/${language}/${namespace}.json`,
      error
    );
    
    // Fallback to English if the requested language file doesn't exist
    if (language !== 'en') {
      try {
        const fallbackData = await import(
          `../../../public/locales/en/${namespace}.json`
        );
        return (fallbackData.default || fallbackData) as Record<string, string>;
      } catch (fallbackError) {
        console.error(
          `Failed to load fallback translation file: locales/en/${namespace}.json`,
          fallbackError
        );
        return {};
      }
    }
    
    return {};
  }
}

