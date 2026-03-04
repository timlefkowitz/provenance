# Grants feature setup

The Grants page lets artists upload a CV and use an AI assistant to discover grant and residency opportunities. It uses **OpenAI** for CV extraction and grant recommendations.

## Environment variable

Add to `.env.local` (and to Vercel or your host's env for production):

```bash
# OpenAI (for grants: CV extraction + grant-finding chatbot)
OPENAI_API_KEY=sk-...
```

Get an API key from [OpenAI API keys](https://platform.openai.com/api-keys). The feature uses `gpt-4o-mini` for cost-effective responses.

## Database migration

Run the migration that adds:

- `user_profiles`: `artist_cv_json`, `artist_cv_file_url`, `artist_cv_uploaded_at`
- Table: `artist_grants`
- Storage bucket: `artist-cvs`

Migration file: `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250301000000_add_artist_cv_and_grants.sql`

If you use a different Supabase project, apply the same schema and bucket (see the migration file for the full SQL).

## Behavior

- **CV upload**: PDF, Word (DOCX), or plain text. Stored in the `artist-cvs` bucket; text is extracted and sent to OpenAI to produce structured JSON saved on the artist profile.
- **Grant list**: Populated by the in-page chatbot. When the model recommends grants, they are saved to `artist_grants` and shown in the left-hand list with filters (e.g. eligible location, deadline).
- **Access**: Only users with an artist profile can open `/grants`; others are redirected to the portal.
