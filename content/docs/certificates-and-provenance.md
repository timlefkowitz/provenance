# Certificates & provenance

Certificates of Authenticity (COAs) are tamper-evident records that link an artwork to its creator and provenance history.

## Certificate types

| Type | Description |
|------|-------------|
| **COA** (Certificate of Authenticity) | Issued by the artist or authorized party |
| **CoS** (Certificate of Show) | Documents exhibition history |

## Issuing a certificate

1. Open an artwork from your collection.
2. Complete provenance fields (title, medium, dimensions, creation date).
3. Navigate to the certificate page (`/artworks/[id]/certificate`).
4. Follow the issuance flow — Provenance generates a unique certificate number and QR code.

Once issued, the certificate gets a public URL that anyone can scan or visit.

## QR codes

Each certificate includes a **QR code** that links to the public certificate page. Print QR codes from the bulk provenance editor (`/artworks/edit-provenance`) for labels, catalogs, or physical certificates.

## Scan tracking

When someone scans a certificate QR code, Provenance logs the scan location (with consent) and displays a map on the certificate page. Artists can see scan analytics from the certificate view.

## Claiming certificates

If you received a certificate link or invite:

1. Visit `/claim/certificate` with your claim token.
2. Sign in or create an account.
3. The certificate is linked to your collection.

Gallery owners can send **owner invites** from the COA page to transfer or assign ownership.

## Provenance research

Collectors can request **provenance research** from a certificate page. This notifies the artist or platform team to investigate and enrich the provenance record.

## Verification API

Developers can programmatically verify assets via the [Verification API](/docs/api/verify). API keys are issued from the admin panel at `/admin/api-keys`.
