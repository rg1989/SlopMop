/**
 * Take documentation screenshots of the running SlopDock dev server.
 * Intercepts API calls with real data so panels render fully.
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * Usage (from project root, with npm run dev already running):
 *   node scripts/screenshot.mjs [workspace-path]
 *
 * workspace-path defaults to the project root (process.cwd()).
 */
import { createRequire } from 'module';
import { execFileSync, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const CWD = process.argv[2] ?? ROOT;
const BASE = 'http://localhost:5173';

mkdirSync(OUT, { recursive: true });

// Resolve playwright-core — try local install first, then npx cache
function resolvePlaywright() {
  const require = createRequire(import.meta.url);
  try { return require.resolve('playwright-core'); } catch { /* not local */ }
  try {
    const out = execSync('npx --no playwright-core --version 2>/dev/null', { encoding: 'utf8' });
    if (!out.includes('Version')) throw new Error('not found');
    const cache = execSync("find ~/.npm/_npx -name 'index.js' -path '*/playwright-core/*' 2>/dev/null | head -1", { encoding: 'utf8' }).trim();
    if (cache) return cache;
  } catch { /* not in npx cache */ }
  throw new Error('playwright-core not found. Run: npx playwright install chromium');
}

const pwPath = resolvePlaywright();
const { default: pkg } = await import(pwPath);
const { chromium } = pkg;

function apiGet(url) {
  try {
    const u = url.replace('localhost:5173', '127.0.0.1:5173');
    return JSON.parse(execFileSync('curl', ['-s', u]).toString());
  } catch { return null; }
}

// Pre-fetch real API data from Express (bypassing Vite proxy issues)
const roadmapData    = apiGet(`http://127.0.0.1:5173/api/gsd-roadmap?cwd=${CWD}`);
const filesData      = apiGet(`http://127.0.0.1:5173/api/files?cwd=${CWD}`);
const gitStatusData  = apiGet(`http://127.0.0.1:5173/api/git-status?cwd=${CWD}`);
const healthData     = apiGet(`http://127.0.0.1:5173/api/project-health?cwd=${CWD}`);
const slopStatus     = apiGet(`http://127.0.0.1:5173/api/slop-status?cwd=${CWD}`);
const sttStatus      = apiGet(`http://127.0.0.1:5173/api/stt/status`);
const ttsStatus      = apiGet(`http://127.0.0.1:5173/api/tts/status`);
const brainData      = apiGet(`http://127.0.0.1:5173/api/brain?cwd=${CWD}`);
const recentPaths    = { paths: [CWD] };
const globalSettings = { settings: { vaultAutoBackup: 'launch' } };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Route all API calls to pre-fetched data so every panel renders fully
const routes = [
  ['**/api/gsd-roadmap**', roadmapData],
  ['**/api/files**', filesData],
  ['**/api/git-status**', gitStatusData],
  ['**/api/project-health**', healthData],
  ['**/api/slop-status**', slopStatus],
  ['**/api/stt/status**', sttStatus],
  ['**/api/tts/status**', ttsStatus],
  ['**/api/recent-paths**', recentPaths],
  ['**/api/global-settings**', globalSettings],
  ['**/api/brain**', brainData],
];
for (const [pattern, data] of routes) {
  await page.route(pattern, route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
}

// Pre-seed localStorage so the app opens the correct workspace
await page.addInitScript((cwd) => {
  localStorage.setItem('slopdock_last_folder', cwd);
  localStorage.setItem('slopdock_recent_paths', JSON.stringify([cwd]));
  localStorage.setItem('slopdock_ui:sidebar_tab', JSON.stringify('explorer'));
  localStorage.setItem('slopdock_settings', JSON.stringify({
    recordingMode: 'hold',
    pttKey: { code: 'Slash', ctrl: false, alt: true, shift: false, meta: false },
    sidebarTabsOrientation: 'horizontal',
    showHiddenFiles: false,
    agent: { command: 'claude', args: [], label: 'Claude' },
  }));
}, CWD);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const snap = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
  console.log(`✓ ${name}`);
};

// Explorer panel
await snap('01-explorer.png');

// GSD Roadmap panel
await page.click('[title="GSD Roadmap"]').catch(() => {});
await page.waitForTimeout(800);
await snap('02-roadmap.png');

// Source Control panel
await page.click('[title="Source Control"]').catch(() => {});
await page.waitForTimeout(800);
await snap('03-source-control.png');

// Settings modal — Display tab
await page.click('[title="GSD Roadmap"]').catch(() => {});
await page.waitForTimeout(400);
await page.click('[title="Settings"]').catch(() => {});
await page.waitForTimeout(600);
await snap('04-settings.png');

// Settings modal — Vault tab
await page.click('text=VAULT').catch(() => {});
await page.waitForTimeout(400);
await snap('05-settings-vault.png');

// Second Brain panel
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('[title="Second Brain"]').catch(() => {});
await page.waitForTimeout(800);
await snap('06-second-brain.png');

// Rules modal
await page.click('[title="Rules"]').catch(() => {});
await page.waitForTimeout(600);
await snap('07-rules.png');

await browser.close();
console.log(`\nAll screenshots saved to docs/screenshots/`);
