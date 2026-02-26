'use client';

import { useEffect } from 'react';

/** Decode minified React error codes for production debugging */
function getReactErrorHint(message: string): string | null {
  if (message.includes('418')) {
    return 'React #418: Hydration failed — server HTML did not match client. See https://react.dev/errors/418';
  }
  if (message.includes('310')) {
    return 'React #310: Rendered more hooks than previous render. See https://react.dev/errors/310';
  }
  return null;
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const hint = getReactErrorHint(error.message);
    console.error('[Provenance Error boundary]', {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
      ...(hint && { hint }),
    });
    if (hint) console.error('[Provenance Error boundary]', hint);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="mt-2 text-sm text-gray-600">
        Check the browser console (F12 → Console) for details.
      </p>
      {(process.env.NODE_ENV === 'development' || error.digest) && (
        <p className="mt-2 max-w-xl text-xs text-red-600 font-mono break-words">
          {error.digest ? `Digest: ${error.digest} — ` : ''}
          {error.message}
        </p>
      )}
      <button
        className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}

