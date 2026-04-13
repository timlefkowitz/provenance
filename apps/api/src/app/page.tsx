import { PLANETS, PLANET_CONFIGS } from '@provenance/core/types';

export default function ApiHome() {
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Provenance Verification API</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Unified asset verification across all Provenance planets (verticals).
      </p>

      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Planets</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {PLANETS.map((id) => {
          const config = PLANET_CONFIGS[id];
          return (
            <li key={id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
              <strong>{config.label}</strong>
              <span style={{ color: '#666', marginLeft: '0.5rem' }}>{config.subdomain}</span>
              <br />
              <span style={{ color: '#888', fontSize: '0.875rem' }}>{config.description}</span>
            </li>
          );
        })}
      </ul>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Endpoints</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem', overflowX: 'auto' }}>
{`POST   /api/v1/verify                        Verify an asset (body: { planet, asset_id })
GET    /api/v1/assets/{planet}/{id}           Get asset details
GET    /api/v1/assets/{planet}/{id}/history   Get asset event history
POST   /api/v1/assets/{planet}                Create an asset
GET    /api/v1/certificates/{number}          Look up a certificate
POST   /api/v1/webhooks                       Register a webhook`}
      </pre>

      <p style={{ color: '#888', fontSize: '0.875rem', marginTop: '2rem' }}>
        All endpoints require a Bearer token. Issue keys from the main Provenance app admin path{' '}
        <strong>/admin/api-keys</strong> (signed-in admin users only).
      </p>
    </main>
  );
}
