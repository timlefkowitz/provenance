## Logging in Provenance

- **Server-side logging** should use the structured `logger` from `src/lib/logger.ts` instead of ad-hoc `console.*` calls.
- **Levels**:
  - `logger.info(event, data)`: high-level lifecycle events and successful operations.
  - `logger.warn(event, data)`: unexpected but non-fatal situations worth tracking.
  - `logger.error(event, data)`: errors that cause a failure or degraded behavior.
- **Event names** should follow `domain_resource_operation_outcome`, e.g. `artwork_create_failed`, `settings_page_fatal`.
- **Context fields**:
  - Always include identifiers when available (e.g. `userId`, `artworkId`, `exhibitionId`, `openCallId`).
  - Include external provider details where helpful (e.g. `provider`, `statusCode`, `errorCode`).
  - Pass `Error` instances as an `error` field; the logger will serialize them to `{ message, name, stack }`.
- **Client-side critical errors** should be sent to `/api/log-client-error` via a helper (see `src/lib/client-logger.ts`) so they appear in Vercel logs.
- Avoid double-logging the same error as it bubbles up; log once at the boundary (server action, API route, or top-level handler).

