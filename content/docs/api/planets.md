# Planets

Provenance organizes assets into **planets** — independent verticals sharing a unified verification API.

## Available planets

| Planet | ID | Subdomain | Description |
|--------|-----|-----------|-------------|
| Artworks | `artworks` | provenance.guru | Art provenance, COAs, artist verification |
| Collectibles | `collectibles` | collc.provenance.guru | Collectible authentication and ownership |
| Real Estate | `realestate` | rest.provenance.guru | Property provenance and title verification |
| Vehicles | `vehicles` | auto.provenance.guru | VIN verification and ownership chain |

## Using planets in API calls

Pass the planet ID as a path parameter or in the request body:

```bash
# Path parameter
GET /api/v1/assets/artworks/{id}

# Body parameter (verify endpoint)
POST /api/v1/verify
{ "planet": "artworks", "asset_id": "..." }
```

## Legacy alias

The verify endpoint accepts `island` as an alias for `planet` in request bodies. Prefer `planet` in new integrations.

## Planet-scoped API keys

When creating an API key at `/admin/api-keys`, you can optionally scope it to a single planet. Scoped keys can only access assets in that planet.

## Asset tables

Each planet maps to a database table:

| Planet | Table |
|--------|-------|
| artworks | `artworks` |
| collectibles | `collectibles` |
| realestate | `properties` |
| vehicles | `vehicles` |

## Subdomain routing

In production, each planet may be deployed on its own subdomain. The Verification API is unified — use the `planet` parameter to target the correct vertical regardless of which subdomain you call.
