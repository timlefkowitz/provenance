# Accounts & roles

Provenance supports three primary account roles, each with different capabilities and subscription plans.

## Roles

### Artist

Artists can:

- Add and manage their own artworks
- Issue certificates of authenticity (COAs)
- Create public profiles and publish creator websites
- Apply to open calls and search for grants
- Use CRM and mailing list tools (with subscription)

### Collector

Collectors can:

- Catalog artworks in their collection
- Toggle artwork visibility (public/private)
- Request provenance research
- Follow artists and favorite artworks

### Gallery

Galleries can:

- Manage multiple artist profiles (with artist consent via claims)
- Invite team members with role-based permissions
- Create and publish exhibitions
- Run CRM, mailing list, and operations workflows
- Post artworks on behalf of represented artists

## Profiles vs accounts

Your **account** is your login identity. **Profiles** are public-facing personas — an artist CV page, a gallery page, etc. One account can have multiple profiles.

Manage profiles at `/profiles`.

## Gallery team access

Galleries can invite team members with granular permissions:

| Permission | Description |
|------------|-------------|
| View | Read gallery data |
| Edit artworks | Modify artwork records |
| Manage team | Invite/remove members |
| CRM access | Use the opportunities board |

See [Artists & profiles](/docs/artists-and-profiles) for profile claims and team setup.

## Admin access

Platform administrators have access to `/admin` for analytics, user management, and API key issuance. Admin status is granted manually via `accounts.public_data.admin`.

## Subscription & trial

- New OAuth sign-ups receive a **14-day trial**.
- Subscription plans are role-based (artist, collector, gallery).
- Manage billing at `/subscription` or via the Stripe customer portal.

Some features require an active subscription:

- Grants AI assistant
- Opportunities AI assistant
- Operations module
- CRM (for some roles)

See [Billing](/docs/billing) for plan details.
