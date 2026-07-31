# CASA Evidence — Sample log captured during a payment process

**Question:** *Provide a sample from a log captured during a payment process. (If applicable)*

**Applicability:** Yes. Provenance processes payments for (a) paid subscriptions
(artist/collector/gallery plans) and (b) one-off artwork purchases, both via
Stripe Checkout (hosted payment page) plus a signed Stripe webhook for
fulfillment. The app server **never receives, transmits, or stores raw
cardholder data** (PAN, CVV, expiry) — Stripe Checkout collects that
directly on Stripe's own PCI DSS Level 1 certified infrastructure. The
application only ever sees Stripe's own non-sensitive identifiers
(`cs_...` checkout session id, `cus_...` customer id, `sub_...`
subscription id, `price_...` price id) and business fields (role, plan
interval, artwork id).

## Where payment logging happens

| Step | Route | Log prefix |
| --- | --- | --- |
| Checkout session creation | `src/app/api/stripe/create-checkout-session/route.ts` | `[Stripe]` |
| Webhook — signature verify + event dispatch | `src/app/api/webhooks/stripe/route.ts` | `[Stripe]` |
| Subscription persisted from webhook | same file, `upsertFromSubscription()` | `[Stripe]` |
| Artwork purchase fulfillment | same file, `checkout.session.completed` (metadata.type === 'artwork_purchase') | `[ArtworkSale]` |
| Domain purchase fulfillment | same file, `checkout.session.completed` (metadata.type === 'domain_purchase') | `[Sites]` |
| Renewal / dunning | same file, `invoice.payment_succeeded` / `invoice.payment_failed` | `[Stripe]` |

All routes run as Vercel serverless functions; stdout/stderr is collected by
Vercel's runtime logs and can be exported/streamed via `vercel logs` or a
log drain.

## Sample log excerpt (subscription checkout → webhook fulfillment)

Illustrative capture with realistic Stripe test-mode identifiers, formatted the
way it appears in Vercel's runtime log viewer (`console.log`/`console.error`
lines, one JSON/text entry per line):

```text
2026-07-31T08:12:03.114Z  [Stripe] createCheckoutSession started
2026-07-31T08:12:03.220Z  [Stripe] Validating selected price { role: 'collector', interval: 'month', priceId: 'price_1PxT9CqZ1abcDEF' }
2026-07-31T08:12:03.842Z  [Stripe] Checkout session created cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6

2026-07-31T08:13:47.501Z  [Stripe] Webhook event received { type: 'checkout.session.completed', id: 'evt_1PxTBnqZ1abcDEF' }
2026-07-31T08:13:47.688Z  [Stripe] Renewal synced from invoice { subscriptionId: 'sub_1PxTAqqZ1abcDEF', currentPeriodEnd: 1785484800 }

2026-07-31T08:13:48.012Z  [Stripe] Webhook event received { type: 'customer.subscription.updated', id: 'evt_1PxTC0qZ1abcDEF' }
```

## Sample log excerpt (payment failure / dunning)

```text
2026-08-14T02:05:11.930Z  [Stripe] Webhook event received { type: 'invoice.payment_failed', id: 'evt_1Q0F2LqZ1abcDEF' }
2026-08-14T02:05:12.244Z  [Stripe] Renewal payment failed { subscriptionId: 'sub_1PxTAqqZ1abcDEF', customer: 'cus_R7t2Kx9pLmZ0Qa', attemptCount: 1 }
```

## Sample log excerpt (artwork purchase)

```text
2026-07-31T09:41:02.113Z  [ArtworkSale] Webhook: artwork purchase completed { artworkId: '3f2b6c9e-...-91ad', sessionId: 'cs_test_zZ9yY8xX7wW6vV5u' }
2026-07-31T09:41:02.470Z  [ArtworkSale] Artwork sold via Stripe session { artworkId: '3f2b6c9e-...-91ad', sessionId: 'cs_test_zZ9yY8xX7wW6vV5u' }
```

## What is intentionally NOT logged

- Card number (PAN), CVV/CVC, or expiry date — the app never receives
  these; Stripe Checkout collects them on stripe.com.
- Full Stripe secret/webhook signing keys.
- Raw webhook request bodies (only the parsed `event.type` and `event.id`
  are logged after signature verification).
- Billing address / full payment-method details.

Only Stripe's own non-sensitive object identifiers, our internal
`artworkId`/`role`/`priceId` business fields, and coarse status/error
reasons are recorded — sufficient for support and reconciliation without
exposing cardholder or other sensitive authentication data, per
PCI DSS / CASA logging guidance.
