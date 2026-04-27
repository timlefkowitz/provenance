import { execSync } from 'child_process';

const run = (cmd) => {
  console.log(`> ${cmd}`);
  const out = execSync(cmd, { cwd: '/vercel/share/v0-project', encoding: 'utf-8' });
  if (out) console.log(out);
};

run('git add "src/lib/valuation/compute-valuation-inputs.ts" "src/app/artworks/[id]/_actions/request-provenance-valuation.ts"');

run(`git commit -m "fix(valuation): surface real failure reason via discriminated union

Replace the opaque 'Could not compute valuation inputs' error with a
discriminated union return type on computeValuationInputs so every
failure path (bad DB query, artwork not found, unexpected exception)
captures and forwards a human-readable reason string to the client.

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"`);

run('git push origin provenance-valuation-error');

console.log('Done — changes pushed to provenance-valuation-error');
