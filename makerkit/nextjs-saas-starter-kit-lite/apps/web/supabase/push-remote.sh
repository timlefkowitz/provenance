#!/usr/bin/env bash
# Push migrations to remote Supabase using DIRECT connection (bypasses pooler).
# Use this if "supabase db push" times out on the pooler.
#
# Usage:
#   SUPABASE_DB_PASSWORD='yourpassword' ./supabase/push-remote.sh
# Or (password with special chars, no single quotes inside):
#   export SUPABASE_DB_PASSWORD='yourpassword'
#   ./supabase/push-remote.sh

set -e
cd "$(dirname "$0")/.."
REF="${SUPABASE_PROJECT_REF:-upbiqtluqemrmonyghix}"

if [ -z "${SUPABASE_DB_PASSWORD}" ]; then
  echo "Set your database password:"
  echo "  export SUPABASE_DB_PASSWORD='yourpassword'"
  echo "  ./supabase/push-remote.sh"
  echo ""
  echo "Or in one line (no single quotes in password):"
  echo "  SUPABASE_DB_PASSWORD='yourpassword' ./supabase/push-remote.sh"
  exit 1
fi

# Direct connection host (not pooler) to avoid timeouts
HOSTNAME="db.${REF}.supabase.co"
PORT="5432"
USER="postgres"
DB="postgres"

# Prefer IPv4 to avoid timeout on networks where IPv6 is broken (dial tcp [::]:5432: i/o timeout)
if command -v dig &>/dev/null; then
  HOST=$(dig +short A "$HOSTNAME" 2>/dev/null | head -n1)
fi
if [ -z "$HOST" ]; then
  HOST="$HOSTNAME"
fi

# Percent-encode password for URL (handles !, @, etc.)
ENC_PASS=$(node -e "console.log(encodeURIComponent(process.env.SUPABASE_DB_PASSWORD))")
DB_URL="postgresql://${USER}:${ENC_PASS}@${HOST}:${PORT}/${DB}"

echo "Pushing migrations via direct connection to ${HOST}..."
npx supabase db push --db-url "$DB_URL"
