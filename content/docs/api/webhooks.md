# Webhooks

Register a webhook URL to receive event notifications when assets are created, verified, or certificates are updated.

## Request

```
POST /api/v1/webhooks
```

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer pk_prov_...` |
| `Content-Type` | `application/json` |

### Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | **Yes** | HTTPS URL to receive webhook payloads |
| `events` | string[] | No | Event types to subscribe to (defaults to all) |

### Valid event types

| Event | Description |
|-------|-------------|
| `asset.created` | New asset created via API |
| `verification.completed` | Verification run completed |
| `certificate.issued` | Certificate issued for an asset |
| `certificate.updated` | Certificate status changed |
| `ownership.transferred` | Ownership changed |

If `events` is omitted, all valid events are subscribed.

### Example

```bash
curl -X POST https://api.provenance.guru/api/v1/webhooks \
  -H "Authorization: Bearer pk_prov_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/provenance",
    "events": ["verification.completed", "certificate.issued"]
  }'
```

## Response

Returns `201 Created`:

```json
{
  "id": "webhook-uuid",
  "url": "https://your-app.com/webhooks/provenance",
  "events": ["verification.completed", "certificate.issued"],
  "account_id": "your-account-uuid",
  "status": "active",
  "created_at": "2026-06-15T12:00:00.000Z",
  "message": "Webhook registered. Webhook delivery will be enabled in a future release."
}
```

> **Note:** Webhook delivery is not yet active. Registration stores your URL and event preferences for when delivery is enabled in a future release.

## Errors

| Status | Cause |
|--------|-------|
| 400 | Missing or invalid `url` |
| 400 | Invalid event type in `events` array |
| 401 | Invalid or missing API key |
| 500 | Registration failure |

## Future delivery format

When delivery is enabled, payloads will be sent as `POST` requests to your registered URL with a JSON body containing the event type, timestamp, and relevant asset/certificate data. Signature verification will be documented at that time.
