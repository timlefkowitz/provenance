-- Seed email_templates with the invite marketing template.
-- Uses ON CONFLICT DO NOTHING so re-running the migration is safe
-- and any admin edits made in production are preserved.

INSERT INTO public.email_templates (template_key, subject, body_markdown)
VALUES (
  'invite',
  'You''re invited to try Provenance',
  $body$## You're invited to try Provenance

Hi {{name}},

Provenance is where artists, galleries, and collectors document artworks, issue certificates of authenticity, and build a permanent record of every work's history. We'd love for you to try it.

---

## Certificates of authenticity that stay current

Most certificates are static PDFs that go out of date the moment something changes. Provenance certificates are **live records** — as an artwork's story evolves, its certificate evolves with it.

- **Issue in minutes** — Create a verifiable certificate of authenticity for any work, backed by a permanent registry.
- **Update over time** — New exhibition, new owner, condition report, restoration? Add it to the record and the certificate reflects it.
- **Share with confidence** — Collectors, galleries, and institutions can verify a certificate at any time with a link or QR code.

---

## Launch your own website

Every account comes with a public profile that works like your own website — no developer, no separate hosting.

- Showcase your portfolio with a clean, professional layout.
- Give each artwork its own page with images, details, and its certificate.
- Share one link with collectors, curators, and press.

---

## Track the full provenance of your work

Provenance keeps the complete history of each work in one place, so nothing gets lost between studios, galleries, and collections.

- **Ownership** — Record sales and transfers with a clear chain of title.
- **Exhibitions** — Log every show a work has appeared in.
- **Condition & events** — Append condition reports, loans, and milestones as they happen.

Every entry becomes part of a permanent, verifiable timeline that travels with the work.

---

## Start in minutes

Create your account, add your first artwork, and issue your first certificate today.

[Create your account]({{siteUrl}}/auth/sign-up)

---

Questions? Reply to this email — we're happy to help.

Best,  
The Provenance team
$body$
)
ON CONFLICT (template_key) DO NOTHING;
