'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      {process.env.NODE_ENV === 'development' && (
        <p className="mt-2 max-w-xl text-sm text-red-600 font-mono break-words">
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

