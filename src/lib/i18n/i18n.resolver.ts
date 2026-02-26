export async function i18nResolver(language: string, namespace: string) {
  // On the client (browser), load from public URL so it works in production.
  // Dynamic import() of public/ files often fails in bundled client code on Vercel.
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/locales/${language}/${namespace}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Record<string, string>;
    } catch (error) {
      console.error(
        `[i18n] Failed to load locales/${language}/${namespace}.json`,
        error
      );
      if (language !== 'en') {
        try {
          const fallback = await fetch(`/locales/en/${namespace}.json`);
          if (fallback.ok) return (await fallback.json()) as Record<string, string>;
        } catch {
          // ignore
        }
      }
      return {};
    }
  }

  // Server: use dynamic import (filesystem)
  try {
    const data = await import(
      `../../../public/locales/${language}/${namespace}.json`
    );
    return (data.default || data) as Record<string, string>;
  } catch (error) {
    console.error(
      `Failed to load translation file: locales/${language}/${namespace}.json`,
      error
    );

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

