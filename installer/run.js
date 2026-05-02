#!/usr/bin/env node
// Thin npx wrapper — downloads and runs install.sh from the SlopMop repo.
// Zero dependencies: only uses Node.js built-ins.

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const INSTALL_SH_URL =
  'https://raw.githubusercontent.com/rg1989/SlopMop/main/scripts/install.sh';

// If run from within a cloned repo (e.g. bash installer/run.js), use the
// local copy of install.sh rather than downloading.
const __dir = dirname(fileURLToPath(import.meta.url));
const LOCAL_SCRIPT = join(__dir, '..', 'scripts', 'install.sh');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading installer`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  let script;

  if (existsSync(LOCAL_SCRIPT)) {
    script = LOCAL_SCRIPT;
  } else {
    const tmp = join(tmpdir(), `slopmop-install-${randomBytes(4).toString('hex')}.sh`);
    process.stdout.write('Downloading installer...\n');
    await download(INSTALL_SH_URL, tmp);
    script = tmp;
  }

  execSync(`bash "${script}"`, { stdio: 'inherit' });
}

main().catch((err) => {
  process.stderr.write(`\nInstall failed: ${err.message}\n`);
  process.exit(1);
});
