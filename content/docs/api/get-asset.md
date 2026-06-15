# Get asset

Retrieve the full record for an asset in a specific planet.

## Request

```
GET /api/v1/assets/{planet}/{id}
```

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `planet` | string | Planet ID |
| `id` | string | Asset UUID |

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer pk_prov_...` |

### Example

```bash
curl https://api.provenance.guru/api/v1/assets/artworks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer pk_prov_your_key"
```

## Response

Returns the full asset row from the planet's database table. Fields vary by planet but typically include:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Untitled (Blue Series No. 7)",
  "account_id": "owner-uuid",
  "image_url": "https://...",
  "medium": "Oil on canvas",
  "dimensions": "48 x 36 in",
  "year": 2024,
  "status": "published",
  "certificate_number": "PROV-2026-001234",
  "certificate_status": "issued",
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-06-01T14:30:00.000Z"
}
```

## Errors

| Status | Cause |
|--------|-------|
| 400 | Invalid planet |
| 401 | Invalid or missing API key |
| 404 | Asset not found |

## Notes

- Planet-scoped API keys must match the requested planet.
- The response includes all columns from the asset table — field availability depends on the planet.
