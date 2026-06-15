# Verify asset

Run verification on an asset and receive a confidence score with risk flags.

## Request

```
POST /api/v1/verify
```

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer pk_prov_...` |
| `Content-Type` | `application/json` |

### Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `planet` | string | Yes | Planet ID: `artworks`, `collectibles`, `realestate`, `vehicles` |
| `asset_id` | string | Yes | UUID of the asset to verify |
| `island` | string | No | Legacy alias for `planet` |

### Example

```bash
curl -X POST https://api.provenance.guru/api/v1/verify \
  -H "Authorization: Bearer pk_prov_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "planet": "artworks",
    "asset_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Response

```json
{
  "asset_id": "550e8400-e29b-41d4-a716-446655440000",
  "planet": "artworks",
  "verified": true,
  "confidence": 0.92,
  "risk_flags": [],
  "sources": ["certificate", "provenance_chain"],
  "certificate_id": "PROV-2026-001234",
  "computed_at": "2026-06-15T12:00:00.000Z"
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `asset_id` | string | The verified asset UUID |
| `planet` | string | Planet the asset belongs to |
| `verified` | boolean | Whether the asset passed verification |
| `confidence` | number | Confidence score (0.0 – 1.0) |
| `risk_flags` | array | Risk indicators found during verification |
| `sources` | array | Data sources used in verification |
| `certificate_id` | string | Associated certificate number, if any |
| `computed_at` | string | ISO 8601 timestamp of verification |

## Side effects

A successful verification creates an event in `asset_events`:

```json
{
  "event_type": "VERIFIED",
  "payload": {
    "confidence": 0.92,
    "verified": true,
    "risk_flags": [],
    "api_key_id": "key-uuid"
  }
}
```

## Errors

| Status | Cause |
|--------|-------|
| 400 | Invalid planet or missing `asset_id` |
| 400 | Planet scope mismatch on API key |
| 401 | Invalid or missing API key |
| 404 | Asset not found in planet |
| 500 | Verification engine failure |
