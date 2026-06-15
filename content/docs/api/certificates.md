# Certificates

Look up a certificate by its globally unique number. Searches across all planets.

## Request

```
GET /api/v1/certificates/{number}
```

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `number` | string | Certificate number (e.g. `PROV-2026-001234`) |

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer pk_prov_...` |

### Example

```bash
curl https://api.provenance.guru/api/v1/certificates/PROV-2026-001234 \
  -H "Authorization: Bearer pk_prov_your_key"
```

## Response

```json
{
  "certificate": {
    "certificate_number": "PROV-2026-001234",
    "planet": "artworks",
    "asset_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "issued"
  },
  "asset": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Untitled (Blue Series No. 7)",
    "image_url": "https://...",
    "status": "published",
    "certificate_status": "issued"
  }
}
```

## Lookup strategy

The endpoint searches in this order:

1. **`certificates` table** — global certificate registry
2. **Planet asset tables** — fallback search across `artworks`, `collectibles`, `vehicles`, and `properties`

This means you can look up any certificate number without knowing the planet in advance.

## Response variants

When found via the global `certificates` table, the full certificate record is returned. When found via a planet table fallback, a simplified certificate object is constructed from the asset's `certificate_number` and `certificate_status` fields.

## Errors

| Status | Cause |
|--------|-------|
| 401 | Invalid or missing API key |
| 404 | Certificate not found |
| 500 | Database query failure |
