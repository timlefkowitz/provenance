'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string; hint?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const details = {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
      hint: (error as any).hint,
    };
    console.error('[Provenance GlobalError]', details);
  }, [error]);

  const hint = (error as any).hint as string | undefined;

  return (
    <html>
      <body>
        <div style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Something went wrong! We are currently in development please check back :)
          </h2>
          <p style={{ marginBottom: '1rem', color: '#555' }}>
            Check the browser console (F12 → Console) for details.
          </p>

          {hint && (
            <pre style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.85rem' }}>
              {hint}
            </pre>
          )}

          <details open style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Error details
            </summary>
            <pre style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', padding: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem', maxHeight: '400px', overflow: 'auto' }}>
              {`Name:    ${error.name}\nMessage: ${error.message}${error.digest ? `\nDigest:  ${error.digest}` : ''}\n\nStack:\n${error.stack ?? 'unavailable'}`}
            </pre>
          </details>

          <button
            style={{ marginTop: '0.5rem', borderRadius: '6px', background: '#3b82f6', color: 'white', padding: '0.5rem 1.5rem', cursor: 'pointer', border: 'none', fontSize: '1rem' }}
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

