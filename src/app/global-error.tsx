'use client';

import { useEffect } from 'react';

/** Decode minified React error codes for easier debugging in production */
function getReactErrorHint(message: string): string | null {
  if (message.includes('418')) {
    return 'React #418: Hydration failed — server HTML did not match client. Common causes: browser extensions (e.g. Grammarly, password managers), dates/times, or conditional client-only content. See https://react.dev/errors/418';
  }
  if (message.includes('310')) {
    return 'React #310: Rendered more hooks than previous render. Hooks may be called conditionally or after early return. See https://react.dev/errors/310';
  }
  if (message.includes("Unexpected token 'export'") || message.includes('webpage_content_reporter')) {
    return "This may be caused by a browser extension injecting scripts. Try a private/incognito window or disable extensions (e.g. Grammarly, ad blockers, password managers).";
  }
  return null;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const hint = getReactErrorHint(error.message);
    console.error('[Provenance GlobalError]', {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
      ...(hint && { hint }),
    });
    if (hint) console.error('[Provenance GlobalError]', hint);
  }, [error]);

  const hint = getReactErrorHint(error.message);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-6 font-sans">
          <h2 className="text-2xl font-bold">Something went wrong!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Check the browser console (F12 → Console) for details.
          </p>
          {hint && (
            <p className="mt-3 max-w-md text-center text-sm text-gray-700">
              {hint}
            </p>
          )}
          {error.digest && (
            <p className="mt-1 text-xs text-gray-500 font-mono">
              Digest: {error.digest}
            </p>
          )}
          <button
            className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
