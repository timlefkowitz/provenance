# Create asset

Create a new asset in a specified planet. A certificate number is auto-generated.

## Request

```
POST /api/v1/assets/{planet}
```

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `planet` | string | Planet ID |

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer pk_prov_...` |
| `Content-Type` | `application/json` |

### Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | **Yes** | Asset title |
| *(other fields)* | varies | No | Planet-specific metadata |

Additional fields are passed through to the planet's database table (e.g. `medium`, `dimensions`, `year` for artworks).

### Example

```bash
curl -X POST https://api.provenance.guru/api/v1/assets/artworks \
  -H "Authorization: Bearer pk_prov_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Untitled (Blue Series No. 7)",
    "medium": "Oil on canvas",
    "dimensions": "48 x 36 in",
    "year": 2024
  }'
```

## Response

Returns `201 Created` with the full asset record:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Untitled (Blue Series No. 7)",
  "account_id": "your-account-uuid",
  "certificate_number": "PROV-2026-001234",
  "certificate_status": "pending",
  "status": "draft",
  "medium": "Oil on canvas",
  "dimensions": "48 x 36 in",
  "year": 2024,
  "created_by": "your-account-uuid",
  "created_at": "2026-06-15T12:00:00.000Z"
}
```

## Auto-generated fields

The API automatically sets:

| Field | Value |
|-------|-------|
| `account_id` | Authenticated account |
| `certificate_number` | Generated via `generate_certificate_number` RPC |
| `certificate_status` | `pending` |
| `status` | `draft` |
| `created_by` / `updated_by` | Authenticated account |

## Side effects

A `CREATED` event is inserted into `asset_events`:

```json
{
  "event_type": "CREATED",
  "payload": { "source": "api", "api_key_id": "key-uuid" }
}
```

## Errors

| Status | Cause |
|--------|-------|
| 400 | Invalid planet or missing `title` |
| 400 | Planet scope mismatch on API key |
| 401 | Invalid or missing API key |
| 500 | Database insert failure |
