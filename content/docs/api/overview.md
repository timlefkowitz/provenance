# Overview

The **Provenance Verification API** provides programmatic access to asset verification, certificate lookup, and asset management across all Provenance **planets** (verticals).

## Base URL

```
https://api.provenance.guru
```

Local development:

```
http://localhost:3100
```

## Quick start

```bash
curl -X POST https://api.provenance.guru/api/v1/verify \
  -H "Authorization: Bearer pk_prov_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"planet": "artworks", "asset_id": "uuid-here"}'
```

## What you can do

| Action | Endpoint |
|--------|----------|
| Verify an asset | `POST /api/v1/verify` |
| Get asset details | `GET /api/v1/assets/{planet}/{id}` |
| Get event history | `GET /api/v1/assets/{planet}/{id}/history` |
| Create an asset | `POST /api/v1/assets/{planet}` |
| Look up certificate | `GET /api/v1/certificates/{number}` |
| Register webhook | `POST /api/v1/webhooks` |

## Planets

Assets live in one of four planets. See [Planets](/docs/api/planets) for details.

## Authentication

All endpoints require a Bearer token. See [Authentication](/docs/api/authentication).

## Response format

Successful responses return JSON. Errors return JSON with an `error` field. See [Errors](/docs/api/errors).

## API keys

Issue keys from the main Provenance app at `/admin/api-keys` (admin access required). Keys use the `pk_prov_` prefix and are stored hashed — the full key is shown only once at creation.
