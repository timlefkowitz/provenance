/**
 * Ensures the ffmpeg-static binary is present. pnpm may skip dependency install
 * scripts unless approved; this runs the same downloader idempotently.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const installJs = path.join(root, 'node_modules', 'ffmpeg-static', 'install.js');

if (!fs.existsSync(installJs)) {
  console.warn('[ensure-ffmpeg-static] ffmpeg-static not installed; skipping');
  process.exit(0);
}

console.log('[ensure-ffmpeg-static] running ffmpeg-static install.js');
execSync(`node "${installJs}"`, { stdio: 'inherit', cwd: root });
