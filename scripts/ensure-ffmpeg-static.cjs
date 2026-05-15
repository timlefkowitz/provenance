/**
 * Ensures the ffmpeg-static binary is present, then copies it into ./vendor/
 * as a real file (not a pnpm symlink). Vercel rejects serverless bundles that
 * trace symlinked node_modules paths ("invalid deployment package").
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.join(__dirname, '..');
const installJs = path.join(root, 'node_modules', 'ffmpeg-static', 'install.js');

if (!fs.existsSync(installJs)) {
  console.warn('[ensure-ffmpeg-static] ffmpeg-static not installed; skipping');
  process.exit(0);
}

console.log('[ensure-ffmpeg-static] running ffmpeg-static install.js');
execSync(`node "${installJs}"`, { stdio: 'inherit', cwd: root });

const requireFromRoot = createRequire(path.join(root, 'package.json'));
let srcBin;
try {
  srcBin = requireFromRoot('ffmpeg-static');
} catch (e) {
  console.warn('[ensure-ffmpeg-static] could not resolve ffmpeg-static', e);
  process.exit(0);
}

if (!srcBin || typeof srcBin !== 'string' || !fs.existsSync(srcBin)) {
  console.error('[ensure-ffmpeg-static] FFmpeg binary path missing after install');
  process.exit(1);
}

const destDir = path.join(root, 'vendor');
const destName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const dest = path.join(destDir, destName);

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(srcBin, dest);
if (process.platform !== 'win32') {
  fs.chmodSync(dest, 0o755);
}

console.log('[ensure-ffmpeg-static] copied FFmpeg to vendor (non-symlinked copy for deploy tracing)');
