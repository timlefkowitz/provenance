# Asset history

Retrieve the full event history for an asset — verifications, creations, ownership transfers, and more.

## Request

```
GET /api/v1/assets/{planet}/{id}/history
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
curl https://api.provenance.guru/api/v1/assets/artworks/550e8400-e29b-41d4-a716-446655440000/history \
  -H "Authorization: Bearer pk_prov_your_key"
```

## Response

```json
{
  "asset_id": "550e8400-e29b-41d4-a716-446655440000",
  "planet": "artworks",
  "events": [
    {
      "id": "event-uuid-1",
      "planet": "artworks",
      "asset_id": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "CREATED",
      "actor_id": "account-uuid",
      "payload": { "source": "api" },
      "created_at": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "event-uuid-2",
      "event_type": "VERIFIED",
      "actor_id": "account-uuid",
      "payload": {
        "confidence": 0.92,
        "verified": true,
        "risk_flags": []
      },
      "created_at": "2026-06-15T12:00:00.000Z"
    }
  ],
  "total": 2
}
```

### Event types

| Type | Description |
|------|-------------|
| `CREATED` | Asset was created |
| `VERIFIED` | Verification was run |
| `CERTIFICATE_ISSUED` | Certificate was issued |
| `OWNERSHIP_TRANSFERRED` | Ownership changed hands |

Events are ordered chronologically (oldest first).

## Errors

| Status | Cause |
|--------|-------|
| 400 | Invalid planet |
| 401 | Invalid or missing API key |
| 500 | Database query failure |
