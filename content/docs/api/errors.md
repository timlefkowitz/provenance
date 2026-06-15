# Errors

The Verification API uses standard HTTP status codes and returns JSON error bodies.

## Error format

```json
{
  "error": "Human-readable error message"
}
```

## Status codes

| Code | Meaning | Common causes |
|------|---------|---------------|
| **400** | Bad Request | Invalid planet, missing required field, invalid JSON, planet scope mismatch |
| **401** | Unauthorized | Missing Bearer token, invalid/inactive/expired API key |
| **404** | Not Found | Asset or certificate not found |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Database failure, verification engine error |

## Examples

### Missing authorization

```json
{
  "error": "Missing or invalid Authorization header. Use: Bearer <api_key>"
}
```

### Invalid API key

```json
{
  "error": "Invalid or inactive API key"
}
```

### Invalid planet

```json
{
  "error": "Invalid planet. Must be one of: artworks, collectibles, realestate, vehicles"
}
```

### Asset not found

```json
{
  "error": "Asset not found in artworks"
}
```

### Planet scope mismatch

```json
{
  "error": "API key is scoped to planet \"artworks\" but request targets \"collectibles\""
}
```

### Invalid webhook events

```json
{
  "error": "Invalid events: foo.bar. Valid: asset.created, verification.completed, certificate.issued, certificate.updated, ownership.transferred"
}
```

## Handling errors

Recommended client-side handling:

1. **401** — Refresh or rotate your API key. Check expiration and active status.
2. **400** — Validate request parameters before retrying. Do not retry invalid requests.
3. **404** — Confirm the asset ID or certificate number exists.
4. **429** — Implement exponential backoff. Respect the rate limit on your key.
5. **500** — Retry with backoff. Contact support if persistent.

## Request validation

The API validates:

- JSON body parsing (returns 400 on malformed JSON)
- Required fields per endpoint
- Planet ID against the allowed list
- URL format for webhook registration
- Event type names for webhook subscriptions
