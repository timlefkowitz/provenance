# Billing

Provenance offers role-based subscription plans powered by Stripe.

## Plans

Plans are tailored by account role:

| Role | Features |
|------|----------|
| **Artist** | Grants assistant, opportunities chat, CRM, operations |
| **Collector** | Enhanced collection tools, provenance research |
| **Gallery** | Team management, CRM, operations, exhibitions |

Visit `/subscription` to see current pricing and plan details.

## Free trial

New accounts signing up via OAuth receive a **14-day trial** with access to subscription features. The trial starts automatically on first sign-in.

## Subscribing

1. Go to `/subscription`.
2. Choose your role plan and billing interval (monthly or yearly).
3. Complete checkout via Stripe.
4. Your subscription activates immediately.

## Managing billing

Access the **Stripe Customer Portal** from `/subscription` to:

- Update payment method
- Change plan or billing interval
- View invoices
- Cancel subscription

The portal is opened via `/api/stripe/create-portal-session`.

## Custom domains

Purchasing a custom domain for your creator website is a separate one-time or recurring charge handled through `/api/stripe/create-domain-checkout-session`.

## Subscription status

Subscription-gated features check your active status before allowing access. If your subscription lapses:

- Grants and opportunities assistants become unavailable
- Operations module is read-only
- CRM access may be restricted

Your artworks, certificates, and public profiles remain intact.

## Webhooks

Stripe subscription events are processed via `/api/webhooks/stripe`. Plan changes sync automatically — no manual action needed after checkout.
