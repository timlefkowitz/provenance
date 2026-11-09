# TODOS

Deferred from the 2026-10-19 roadmap CEO review ([docs/roadmap-ceo-review-2026-10-19.md](docs/roadmap-ceo-review-2026-10-19.md)). Strategy: primary revenue from major galleries and institutions (both this year), artist tool as the secondary career benefit.

- **Provenance intelligence / unknown works** (R1, D3). Pull history from news and publications, flag unattributed works. Trigger: a paying institution asks. Risk: legal and data quality. P3.
- **Expand grants & opportunities** (R2, D4). The grants AI assistant (2026-04-04) stays live. Known issue: AI-generated `artist_grants` rows often carry wrong deadlines or eligibility. P3.
- **Evaluation & insurance adjacency** (R3, D5). Appraisal and insurance workflow on museum metadata standards. Trigger: a signed insurer or appraiser partner. The Operations insurance module covers galleries until then. P3.
- **Museum donation & loan flows** (R4, D6, re-confirmed D20). Trigger: the first museum in active conversation, so it gets designed with them. P2.
- **Regenerate Supabase types** (R7, D9). Retire hand-merged `AppDatabase` types (`src/lib/supabase-app-database.ts`). Housekeeping. P3.
- **Institutional procurement pack** (D17). SSO/SAML, security questionnaire answers, uptime commitment, backup/PITR and restore evidence. Trigger: the first outside gallery or museum procurement process. P2.
