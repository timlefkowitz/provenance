-- Seed email_templates with the institution_thanks template.
-- Uses ON CONFLICT DO NOTHING so re-running the migration is safe
-- and any admin edits made in production are preserved.

INSERT INTO public.email_templates (template_key, subject, body_markdown)
VALUES (
  'institution_thanks',
  'Thank you from Provenance',
  $body$## Provenance wants to thank you for taking the time with us.

Hi {{name}},

We genuinely appreciate you exploring what Provenance is building for institutions. This email walks through everything the platform offers your team — from a unified certificate registry to the operations tools registrars use every day. We hope it is useful as you evaluate where Provenance fits alongside your existing workflows.

---

## One registry: authenticity, ownership, and intermediary in sync

Certificates of authenticity, ownership, and intermediary share the same underlying record — so curatorial narrative, legal title, and market handoffs never drift into conflicting PDFs. Provenance transfers with a structured handoff: counterparties review the package and accept with one click to advance custody and visibility, instead of re-keying data across inboxes.

- **Certificate of authenticity** — Artist-anchored authenticity that travels with the object and stays aligned with curatorial files.
- **Certificate of ownership** — Clear title and custodial context so acquisitions, donors, and deaccessions stay auditable.
- **Certificate of intermediary** — Dealers, lenders, and registrars meet in the middle — documenting the handoff without fragmenting the record.

**One-click accept for provenance transfers.** Bundle condition, certificates, and event history into a single transfer. The receiving institution or collector confirms in one action — preserving a defensible timeline for loans, acquisitions, and outgoing movement alike.

---

## Built for registrars — not generic inventory software

Most tools stop at object IDs and locations. Provenance couples collection management with certificates, events, and verification so the record you maintain inside the building matches what partners see outside it.

- **Provenance-first, not spreadsheet-first** — Accession, location, and exhibition history stay tied to the same certificate graph your partners verify.
- **One source of truth across departments** — Curatorial, registrar, and development views pull from shared records — fewer reconciliations before a loan or audit.
- **Append-only events you can defend** — Custody changes and internal movements emit transparent records instead of silent edits buried in a TMS export.
- **Built for public trust** — Verification-friendly certificates and APIs meet institutions where donors, boards, and traveling shows expect clarity.

---

## From catalog to contracts — without leaving the collection record

- **Invoicing** — Create and send professional invoices directly from your collection. Track payments, generate PDFs, and keep your financial records alongside your art records.
- **Artwork loan agreements** — Generate and manage loan agreements with a few clicks. Define terms, conditions, insurance requirements, and get digital signatures — all in one place.
- **Artwork label maker** — Create print-ready labels for exhibitions and storage. Include artwork details, QR codes linking to certificates, and custom formatting for any display context.
- **Exhibitions checklist** — Coordinate install, condition checks, lender requirements, and registrar sign-offs on one checklist tied to the exhibition record — so curatorial, prep, and front-of-house stay aligned from load-in through deinstall.
- **Cataloging & provenance** — Full accessioning, provenance tracking, and location management. Record every detail — dimensions, medium, condition, exhibition history, and ownership chain.
- **Team and staff linked accounts** — Link registrars, curators, and operations staff to your institution workspace with role-aware access — shared collection and certificate context, individual sign-ins, and clearer accountability than a single shared login.

---

## Early proof & previews

We are shipping evidence as fast as we ship code — here is where the platform stands today:

- **Event ledger** — Public read on asset_events for transparency; authenticated inserts only — no silent edits.
- **Certificates table** — Unified certificate registry spanning art, collectibles, vehicles, and real property verticals.
- **API surface** — Key management exists in-database; HTTP verification routes ship next on your timeline.

---

## What registrars are telling us

> "We are evaluating Provenance where our TMS ends and public trust begins — especially for traveling exhibitions."
>
> *— Registrar office, permission pending*

---

## Frequently asked questions

**How do certificates of authenticity, ownership, and intermediary work together?**  
They share the same registry-backed record so authenticity, title, and handoff context stay aligned. Structured transfers let counterparties accept provenance updates in one action instead of reconciling separate PDFs.

**What does append-only asset event logging give our registrar team?**  
Each custody or movement change emits a transparent record with actor, payload, and timestamp — ideal for loans, cross-department accountability, and the traveling-exhibition paper trail boards expect.

**How mature is the HTTP verification API?**  
API key storage, scopes, and rate limits exist in the database today; wire your preferred edge or service layer to expose partner endpoints when you are ready.

---

## Built for boards, donors, and partner scrutiny

Museums need more than a login page. Provenance pairs collection accountability with controls designed for institutional trust.

- **Append-only event ledger** — Custody and movement changes record actor, timestamp, and payload — authenticated inserts only, so history cannot be silently overwritten.
- **Scoped API keys** — Keys are stored with scopes and rate limits in mind, so partner verification and integrations expose only what your institution configures.
- **Encryption in transit and at rest** — Industry-standard TLS protects traffic between browsers, apps, and our services; data at rest is encrypted within our cloud infrastructure.
- **Role-aware team access** — Registrars, curators, and operations staff use individual accounts tied to your institution workspace — not a single shared login — so access stays accountable.

---

## Bring certificates, collection ops, and provenance into one workflow

Subscribe to align your team on a registry-shaped record that scales from accessioning desks to partner verification APIs.

Thank you again for your time. We would love to hear what you think — your feedback shapes what we build next.

[Share your feedback]({{feedbackUrl}})

[Visit the institution page]({{institutionUrl}})
$body$
)
ON CONFLICT (template_key) DO NOTHING;
