export default function SiteNotFound() {
  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: '#fff',
        color: '#111',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#aaa' }}>
        404
      </p>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
        Site not found
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#777', margin: 0 }}>
        This site may not exist or hasn&apos;t been published yet.
      </p>
      <a
        href="https://provenance.app"
        style={{
          marginTop: '1rem',
          fontSize: '0.75rem',
          color: '#4A2F25',
          textDecoration: 'underline',
        }}
      >
        Provenance
      </a>
    </div>
  );
}
