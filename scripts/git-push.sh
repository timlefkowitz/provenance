#!/bin/bash
set -e

cd /vercel/share/v0-project

git add src/lib/valuation/compute-valuation-inputs.ts \
        src/app/artworks/[id]/_actions/request-provenance-valuation.ts

git commit -m "fix(valuation): surface real failure reason via discriminated union

Replace the opaque 'Could not compute valuation inputs' error with a
discriminated union return type on computeValuationInputs so every
failure path (bad DB query, artwork not found, unexpected exception)
captures and forwards a human-readable reason string to the client.

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"

git push origin provenance-valuation-error
