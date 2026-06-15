# Operations

The operations module provides gallery-grade logistics tools: loans, consignments, invoices, acquisitions, and more.

## Access

Go to **Operations** (`/operations`) from the Toolbox. Requires an active **subscription**.

## Modules

| Module | Description |
|--------|-------------|
| **Loans** | Track artworks on loan — lender, borrower, dates, insurance |
| **Consignments** | Manage consignment agreements and terms |
| **Invoices** | Generate and download PDF invoices |
| **Acquisitions** | Record artwork purchases and provenance transfers |
| **Condition reports** | Document artwork condition at intake and return |
| **Insurance valuations** | Store appraisal and insurance values |
| **Vendors** | Manage framers, shippers, and service providers |
| **Exhibition plans** | Plan logistics for upcoming shows |
| **Artwork locations** | Track where each piece is physically located |

## Creating records

Each module has a create flow accessible from the operations dashboard. Link records to specific artworks from your collection for full traceability.

## PDF exports

Loans, consignments, and invoices can be exported as PDFs:

- `/api/operations/invoices/[id]/pdf`
- `/api/operations/loans/[id]/pdf`
- `/api/operations/consignments/[id]/pdf`

These endpoints require authentication and an active subscription.

## Alerts

Provenance sends automated alerts for expiring loans and consignments via the cron job at `/api/cron/operations-alerts`. Ensure your account email is up to date in settings.

## Best practices

- Link every operations record to an artwork for audit trails.
- Set reminder dates on loans before they expire.
- Use condition reports at both loan intake and return.
