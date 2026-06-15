# Authentication

All Verification API endpoints require a **Bearer token** in the `Authorization` header.

## Header format

```
Authorization: Bearer pk_prov_your_api_key_here
```

## Obtaining an API key

1. Sign in to Provenance as an admin user.
2. Navigate to `/admin/api-keys`.
3. Click **Create key**.
4. Copy the key immediately — it is shown only once.

Keys are prefixed with `pk_prov_` and stored as SHA-256 hashes in the `api_keys` table.

## Key properties

| Property | Description |
|----------|-------------|
| `account_id` | The account that owns the key |
| `scopes` | Permission scopes (future use) |
| `planet` | Optional planet scope — key works only for that planet |
| `rate_limit` | Requests per hour (default: 1000) |
| `expires_at` | Optional expiration timestamp |
| `is_active` | Whether the key is enabled |

## Planet-scoped keys

If a key is scoped to a specific planet (e.g. `artworks`), requests targeting a different planet return `400 Bad Request`:

```json
{
  "error": "API key is scoped to planet \"artworks\" but request targets \"collectibles\""
}
```

## Rate limiting

Each key has a configurable rate limit (default 1000 requests/hour). Exceeding the limit returns `429 Too Many Requests`.

## Key lifecycle

- **Last used** timestamp updates on every authenticated request.
- **Revoke** keys from `/admin/api-keys` — revoked keys return `401`.
- **Expired** keys return `401` with message `"API key has expired"`.

## Example

```bash
curl https://api.provenance.guru/api/v1/assets/artworks/abc-123 \
  -H "Authorization: Bearer pk_prov_abc123..."
```

## Error responses

| Status | Message |
|--------|---------|
| 401 | Missing or invalid Authorization header |
| 401 | Invalid or inactive API key |
| 401 | API key has expired |

See [Errors](/docs/api/errors) for the full error format.
