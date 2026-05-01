import express from 'express';
import { createServer } from 'http';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { readFile, writeFile, access as fsAccess, readdir, rm, mkdir, rename, stat } from 'fs/promises';
import { isBinaryFile } from 'isbinaryfile';
import { createHighlighter, type Highlighter } from 'shiki';
import { attachWebSocketServer } from './ws-handler.js';
import { buildFileTree, getGitChangedPaths, getGitStatus } from './file-api.js';
import { initPiper, getPiperStatus, synthesize } from './piper-tts.js';
import { checkWhisper, getWhisperStatus, transcribe } from './whisper-stt.js';
import { parseRoadmapMd, parseStateMd, patchRoadmapRemovePlan } from './gsd.js';

const execFileAsync = promisify(execFile);

// Shiki highlighter — initialized once at server startup
let _hl: Highlighter | null = null;
async function getHighlighter(): Promise<Highlighter> {
  if (!_hl) {
    _hl = await createHighlighter({
      themes: ['one-dark-pro'],
      langs: [
        'typescript', 'javascript', 'tsx', 'jsx',
        'python', 'json', 'css', 'scss', 'html', 'xml',
        'markdown', 'yaml', 'bash', 'toml',
        'rust', 'go', 'java', 'c', 'cpp', 'sql',
        'dockerfile', 'diff',
      ],
    });
  }
  return _hl;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
const server = createServer(app);

// Serve static files from client/dist in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const SLOP_DIR = path.join(os.homedir(), '.slop');
const SETTINGS_FILE = path.join(SLOP_DIR, 'settings.json');
const RECENTS_FILE = path.join(SLOP_DIR, 'recents.json');
const BACKUP_ROOT = path.join(SLOP_DIR, 'backups');

const VAULT_TARGETS = [
  { id: 'claude-settings',       src: path.join(os.homedir(), '.claude/settings.json'),             dest: path.join(BACKUP_ROOT, 'claude/settings.json') },
  { id: 'claude-settings-local', src: path.join(os.homedir(), '.claude/settings.local.json'),       dest: path.join(BACKUP_ROOT, 'claude/settings.local.json') },
  { id: 'claude-md',             src: path.join(os.homedir(), '.claude/CLAUDE.md'),                 dest: path.join(BACKUP_ROOT, 'claude/CLAUDE.md') },
  { id: 'claude-keybindings',    src: path.join(os.homedir(), '.claude/keybindings.json'),          dest: path.join(BACKUP_ROOT, 'claude/keybindings.json') },
  { id: 'gsd-config',            src: path.join(os.homedir(), '.claude/get-shit-done/config.json'), dest: path.join(BACKUP_ROOT, 'gsd/config.json') },
  { id: 'git-config',            src: path.join(os.homedir(), '.gitconfig'),                        dest: path.join(BACKUP_ROOT, 'git/.gitconfig') },
  { id: 'ssh-config',            src: path.join(os.homedir(), '.ssh/config'),                       dest: path.join(BACKUP_ROOT, 'ssh/config') },
] as const;

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}

async function isSourceNewer(src: string, dest: string): Promise<boolean> {
  try {
    const [srcStat, destStat] = await Promise.all([stat(src), stat(dest)]);
    return srcStat.mtimeMs > destStat.mtimeMs;
  } catch {
    try { await stat(src); return true; } catch { return false; }
  }
}

async function autoBackupVault(): Promise<void> {
  await mkdir(BACKUP_ROOT, { recursive: true });
  for (const t of VAULT_TARGETS) {
    try {
      const newer = await isSourceNewer(t.src, t.dest);
      if (!newer) continue;
      await mkdir(path.dirname(t.dest), { recursive: true });
      const content = await readFile(t.src, 'utf-8');
      await atomicWrite(t.dest, content);
    } catch { /* per-target failure is acceptable */ }
  }
}

// Known AI agent CLIs — checked against PATH to power the settings combobox
const KNOWN_AGENTS = ['claude', 'opencode', 'aider', 'gemini', 'codex', 'hermes', 'goose'];

async function commandExists(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [cmd]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// GET /api/known-agents — returns installed subset of known agent CLIs
app.get('/api/known-agents', async (_req, res) => {
  const results = await Promise.all(
    KNOWN_AGENTS.map(async (cmd) => ({ cmd, path: await commandExists(cmd) }))
  );
  res.json(results.filter(r => r.path !== null));
});

// GET /api/which?cmd=... — checks if an arbitrary command exists in PATH
app.get('/api/which', async (req, res) => {
  const cmd = String(req.query.cmd ?? '').trim();
  if (!cmd || cmd.includes('/') || cmd.includes(' ')) {
    res.status(400).json({ error: 'invalid command' });
    return;
  }
  const resolved = await commandExists(cmd);
  res.json({ found: resolved !== null, path: resolved });
});

// GET /api/project-health?cwd=...&agent=...
app.get('/api/project-health', async (req, res) => {
  const { cwd, agent = 'claude' } = req.query as { cwd?: string; agent?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }

  const resolved = path.resolve(cwd as string);

  let dirAccessible = false;
  try { await fsAccess(resolved); dirAccessible = true; } catch { /* inaccessible */ }

  let isGitRepo = false;
  try {
    await execFileAsync('git', ['-C', resolved, 'rev-parse', '--git-dir']);
    isGitRepo = true;
  } catch { /* not a git repo */ }

  let hasClaudeMd = false;
  try { await fsAccess(path.join(resolved, 'CLAUDE.md')); hasClaudeMd = true; } catch { /* missing */ }

  const agentPath = await commandExists(agent as string);

  let hasNodeModules: boolean | null = null;
  const hasPkgJson = await fsAccess(path.join(resolved, 'package.json')).then(() => true).catch(() => false);
  if (hasPkgJson) {
    hasNodeModules = await fsAccess(path.join(resolved, 'node_modules')).then(() => true).catch(() => false);
  }

  res.json({
    dirAccessible,
    isGitRepo,
    hasClaudeMd,
    agentFound: agentPath !== null,
    agentPath,
    hasNodeModules,
  });
});

// Open native macOS folder picker, return the selected absolute path
app.post('/api/pick-folder', async (_req, res) => {
  if (process.platform !== 'darwin') {
    res.status(400).json({ error: 'Native picker only available on macOS' });
    return;
  }
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Choose a folder for Claude CLI")',
    ]);
    res.json({ path: stdout.trim() });
  } catch {
    // User cancelled the dialog
    res.status(400).json({ error: 'cancelled' });
  }
});

app.post('/api/pick-file', async (req, res) => {
  if (process.platform !== 'darwin') {
    res.status(400).json({ error: 'Native picker only available on macOS' });
    return;
  }
  const { cwd } = req.body as { cwd?: string };
  const defaultLoc = cwd ? ` default location POSIX file "${cwd}"` : '';
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      `set theFiles to (choose file with prompt "Attach file(s)" ${defaultLoc}with multiple selections allowed)\nset out to ""\nrepeat with f in theFiles\n  set out to out & POSIX path of f & "\n"\nend repeat\nreturn out`,
    ]);
    const paths = stdout.split('\n').map(p => p.trim()).filter(Boolean);
    res.json({ paths });
  } catch {
    res.status(400).json({ error: 'cancelled' });
  }
});

app.get('/api/homedir', (_req, res) => {
  res.json({ path: os.homedir() });
});

// GET /api/files — return a nested JSON tree of files and directories
app.get('/api/files', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) {
    res.status(400).json({ error: 'cwd required' });
    return;
  }
  try {
    const tree = await buildFileTree(path.resolve(cwd));
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/git-status — return staged/unstaged file lists + flat changedPaths for tree highlighting
app.get('/api/git-status', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  const result = await getGitStatus(path.resolve(cwd));
  res.json(result);
});

// POST /api/git-stage — stage one or more files
app.post('/api/git-stage', async (req, res) => {
  const { cwd, paths: filePaths } = req.body as { cwd?: string; paths?: string[] };
  if (!cwd || !filePaths?.length) { res.status(400).json({ error: 'cwd and paths required' }); return; }
  const resolvedCwd = path.resolve(cwd);
  const relPaths = filePaths.map(p => path.relative(resolvedCwd, p));
  try {
    await execFileAsync('git', ['-C', resolvedCwd, 'add', '--', ...relPaths]);
    res.json({ ok: true });
  } catch (err) { res.json({ ok: false, error: String(err) }); }
});

// POST /api/git-unstage — unstage one or more files
app.post('/api/git-unstage', async (req, res) => {
  const { cwd, paths: filePaths } = req.body as { cwd?: string; paths?: string[] };
  if (!cwd || !filePaths?.length) { res.status(400).json({ error: 'cwd and paths required' }); return; }
  const resolvedCwd = path.resolve(cwd);
  const relPaths = filePaths.map(p => path.relative(resolvedCwd, p));
  try {
    await execFileAsync('git', ['-C', resolvedCwd, 'restore', '--staged', '--', ...relPaths]);
    res.json({ ok: true });
  } catch (err) { res.json({ ok: false, error: String(err) }); }
});

// POST /api/git-discard — discard working tree changes (rm for untracked, checkout for tracked)
app.post('/api/git-discard', async (req, res) => {
  const { cwd, paths: filePaths } = req.body as { cwd?: string; paths?: string[] };
  if (!cwd || !filePaths?.length) { res.status(400).json({ error: 'cwd and paths required' }); return; }
  const resolvedCwd = path.resolve(cwd);
  try {
    // Get current git status to distinguish untracked vs tracked
    const status = await getGitStatus(resolvedCwd);
    const untrackedSet = new Set(status.unstaged.filter(f => f.status === '?').map(f => f.path));
    const tracked: string[] = [];
    const untracked: string[] = [];
    for (const p of filePaths) {
      if (untrackedSet.has(p)) untracked.push(p);
      else tracked.push(p);
    }
    if (tracked.length) {
      const relTracked = tracked.map(p => path.relative(resolvedCwd, p));
      await execFileAsync('git', ['-C', resolvedCwd, 'checkout', '--', ...relTracked]);
    }
    if (untracked.length) {
      const { unlink } = await import('fs/promises');
      await Promise.all(untracked.map(p => unlink(p)));
    }
    res.json({ ok: true });
  } catch (err) { res.json({ ok: false, error: String(err) }); }
});

// POST /api/git-commit — commit staged changes with a message
app.post('/api/git-commit', async (req, res) => {
  const { cwd, message } = req.body as { cwd?: string; message?: string };
  if (!cwd || !message?.trim()) { res.status(400).json({ error: 'cwd and message required' }); return; }
  try {
    await execFileAsync('git', ['-C', path.resolve(cwd), 'commit', '-m', message.trim()]);
    res.json({ ok: true });
  } catch (err) { res.json({ ok: false, error: String(err) }); }
});

// GET /api/git-diff — return unified diff text for a file
app.get('/api/git-diff', async (req, res) => {
  const { cwd, path: filePath, staged } = req.query as { cwd?: string; path?: string; staged?: string };
  if (!cwd || !filePath) { res.status(400).json({ error: 'cwd and path required' }); return; }
  const resolvedCwd = path.resolve(cwd);
  const relPath = path.relative(resolvedCwd, filePath);
  try {
    const args = staged === 'true'
      ? ['-C', resolvedCwd, 'diff', '--cached', '--', relPath]
      : ['-C', resolvedCwd, 'diff', '--', relPath];
    const { stdout } = await execFileAsync('git', args);
    if (stdout.trim()) {
      res.json({ diff: stdout });
    } else {
      // Untracked or new file with no staged diff — show file content as added lines
      const absPath = path.resolve(resolvedCwd, relPath);
      const buffer = await readFile(absPath).catch(() => null);
      if (!buffer) { res.json({ diff: '' }); return; }
      const content = buffer.toString('utf-8');
      const added = content.split('\n').map(l => `+${l}`).join('\n');
      const header = `--- /dev/null\n+++ b/${relPath}\n@@ -0,0 +1,${content.split('\n').length} @@\n`;
      res.json({ diff: header + added });
    }
  } catch (err) { res.json({ diff: '', error: String(err) }); }
});

// GET /api/file — return text content or base64 for binary/image files
app.get('/api/file', async (req, res) => {
  const { cwd, path: relPath } = req.query as { cwd?: string; path?: string };
  if (!cwd || !relPath) {
    res.status(400).json({ error: 'cwd and path required' });
    return;
  }

  const resolvedCwd = path.resolve(cwd);
  const absPath = path.resolve(resolvedCwd, relPath);

  // Security: block path traversal
  if (!absPath.startsWith(resolvedCwd + path.sep) && absPath !== resolvedCwd) {
    res.status(403).json({ error: 'Path outside cwd' });
    return;
  }

  try {
    const buffer = await readFile(absPath);
    const binary = await isBinaryFile(buffer, buffer.length);

    if (binary) {
      const ext = path.extname(absPath).toLowerCase();
      const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
      const isImage = imageExts.has(ext);
      res.json({ type: 'binary', isImage, base64: buffer.toString('base64'), ext });
    } else {
      res.json({ type: 'text', content: buffer.toString('utf-8') });
    }
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: String(err) });
    }
  }
});

// PUT /api/file — overwrite a file with new content
app.put('/api/file', async (req, res) => {
  const { cwd, path: relPath, content } = req.body as { cwd?: string; path?: string; content?: string };
  if (!cwd || !relPath || content === undefined) {
    res.status(400).json({ error: 'cwd, path, and content required' });
    return;
  }

  const resolvedCwd = path.resolve(cwd);
  const absPath = path.resolve(resolvedCwd, relPath);

  // Security: block path traversal
  if (!absPath.startsWith(resolvedCwd + path.sep) && absPath !== resolvedCwd) {
    res.status(403).json({ error: 'Path outside cwd' });
    return;
  }

  try {
    await writeFile(absPath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/highlight', async (req, res) => {
  const { content, lang } = req.body as { content?: string; lang?: string };
  if (!content || !lang) { res.json({ html: null }); return; }
  try {
    const hl = await getHighlighter();
    const html = hl.codeToHtml(content, { lang, theme: 'one-dark-pro' });
    res.json({ html });
  } catch {
    res.json({ html: null });
  }
});

app.get('/api/git-branch', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.json({ branch: null }); return; }
  try {
    const { stdout } = await execFileAsync('git', ['-C', path.resolve(cwd), 'branch', '--show-current']);
    res.json({ branch: stdout.trim() || null });
  } catch {
    res.json({ branch: null });
  }
});

app.get('/api/git-branches', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.json({ branches: [] }); return; }
  try {
    const { stdout } = await execFileAsync('git', ['-C', path.resolve(cwd), 'branch', '--format=%(refname:short)']);
    const branches = stdout.split('\n').map((b: string) => b.trim()).filter(Boolean);
    res.json({ branches });
  } catch {
    res.json({ branches: [] });
  }
});

app.post('/api/git-checkout', async (req, res) => {
  const { cwd, branch } = req.body as { cwd?: string; branch?: string };
  if (!cwd || !branch) { res.status(400).json({ error: 'cwd and branch required' }); return; }
  try {
    await execFileAsync('git', ['-C', path.resolve(cwd), 'checkout', branch]);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: String(err) });
  }
});

// STT status — returns { available, setupHint }
app.get('/api/stt/status', (_req, res) => {
  res.json(getWhisperStatus());
});

// STT transcription — POST raw audio blob → { text }
app.post('/api/stt', (req, res) => {
  const mimeType = (req.headers['content-type'] ?? 'audio/webm').split(';')[0].trim();
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', async () => {
    const audioBuffer = Buffer.concat(chunks);
    const text = await transcribe(audioBuffer, mimeType);
    if (text === null) {
      const { setupHint } = getWhisperStatus();
      res.status(503).json({ error: 'Whisper STT unavailable', setupHint });
      return;
    }
    // text may be '' (no speech detected) — that's fine, client ignores empty results
    res.json({ text });
  });
});

// TTS status — returns { available, voice, setupHint }
app.get('/api/tts/status', (_req, res) => {
  res.json(getPiperStatus());
});

// TTS synthesis — POST { text } → audio/wav
app.post('/api/tts', async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) { res.status(400).json({ error: 'text required' }); return; }
  const wav = await synthesize(text.slice(0, 1000));
  if (!wav) {
    const { setupHint } = getPiperStatus();
    res.status(503).json({ error: 'Piper TTS unavailable', setupHint });
    return;
  }
  res.type('audio/wav').send(wav);
});

// GET /api/gsd-roadmap — parse .planning/ and return structured roadmap data
app.get('/api/gsd-roadmap', async (req, res) => {
  const cwd = (req.query.cwd as string) ?? '';
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }

  const resolvedCwd = path.resolve(cwd);
  const planningDir = path.join(resolvedCwd, '.planning');

  try { await fsAccess(planningDir); } catch { res.json({ exists: false }); return; }

  let roadmapContent = '';
  try { roadmapContent = await readFile(path.join(planningDir, 'ROADMAP.md'), 'utf-8'); }
  catch { res.json({ exists: true, error: 'ROADMAP.md not found' }); return; }

  let stateContent = '';
  try { stateContent = await readFile(path.join(planningDir, 'STATE.md'), 'utf-8'); } catch { /* optional */ }

  const parsedPhases = parseRoadmapMd(roadmapContent);
  const stateData = parseStateMd(stateContent);

  let phaseDirs: string[] = [];
  try {
    const entries = await readdir(path.join(planningDir, 'phases'), { withFileTypes: true });
    phaseDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch { /* phases dir may not exist */ }

  let quickDirNames: string[] = [];
  try {
    const entries = await readdir(path.join(planningDir, 'quick'), { withFileTypes: true });
    quickDirNames = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => parseInt(a) - parseInt(b));
  } catch { /* quick dir may not exist */ }

  const phases = await Promise.all(parsedPhases.map(async p => {
    const numStr = String(Math.floor(p.number)).padStart(2, '0');
    const dirName = phaseDirs.find(d => d.startsWith(numStr + '-')) ?? '';
    const absPhaseDir = dirName ? path.join(planningDir, 'phases', dirName) : null;

    const plans = await Promise.all(p.plans.map(async plan => {
      const planId = plan.file.replace('-PLAN.md', '');
      const summaryFile = plan.file.replace('-PLAN.md', '-SUMMARY.md');
      const summaryPath = absPhaseDir ? path.join(absPhaseDir, summaryFile) : null;
      const planFilePath = absPhaseDir ? path.join(absPhaseDir, plan.file) : null;
      // When a phase dir exists, SUMMARY.md presence is authoritative (both ways)
      let completed = plan.completed;
      if (summaryPath) {
        try { await fsAccess(summaryPath); completed = true; } catch { completed = false; }
      }
      return {
        id: planId,
        name: plan.name,
        completed,
        planPath: planFilePath,
        summaryPath,
      };
    }));

    // Recalculate phase completion from actual plan data
    const phaseCompleted = plans.length > 0 && plans.every(pl => pl.completed);

    // Only return research/verification paths when the files actually exist
    let researchPath: string | null = null;
    let verificationPath: string | null = null;
    if (absPhaseDir) {
      const rFile = path.join(absPhaseDir, `${numStr}-RESEARCH.md`);
      const vFile = path.join(absPhaseDir, `${numStr}-VERIFICATION.md`);
      try { await fsAccess(rFile); researchPath = rFile; } catch { /* not present */ }
      try { await fsAccess(vFile); verificationPath = vFile; } catch { /* not present */ }
    }

    return {
      number: p.number,
      name: p.name,
      goal: p.goal,
      completed: phaseCompleted,
      dirName,
      researchPath,
      verificationPath,
      plans,
    };
  }));

  const quickTasks = await Promise.all(quickDirNames.map(async dirName => {
    const num = parseInt(dirName);
    const stateTask = stateData.quickTasks.find(q => q.number === num);
    const quickDir = path.join(planningDir, 'quick', dirName);
    const planFile = path.join(quickDir, `${num}-PLAN.md`);
    const summaryFile = path.join(quickDir, `${num}-SUMMARY.md`);
    let completed = false;
    let hasPlan = false;
    try { await fsAccess(summaryFile); completed = true; } catch { /* not done */ }
    try { await fsAccess(planFile); hasPlan = true; } catch { /* no plan file */ }
    return {
      number: num,
      description: stateTask?.description ?? dirName.replace(/^\d+-/, '').replace(/-/g, ' '),
      date: stateTask?.date ?? '',
      completed,
      dirName,
      planPath: hasPlan ? planFile : null,
    };
  }));

  // Collect optional planning doc paths that exist
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const statePath = path.join(planningDir, 'STATE.md');
  let projectPath: string | null = null;
  let requirementsPath: string | null = null;
  try { await fsAccess(path.join(planningDir, 'PROJECT.md')); projectPath = path.join(planningDir, 'PROJECT.md'); } catch { /* optional */ }
  try { await fsAccess(path.join(planningDir, 'REQUIREMENTS.md')); requirementsPath = path.join(planningDir, 'REQUIREMENTS.md'); } catch { /* optional */ }

  res.json({ exists: true, milestone: stateData.milestone, milestoneName: stateData.milestoneName, status: stateData.status, progress: stateData.progress, phases, quickTasks, roadmapPath, statePath, projectPath, requirementsPath });
});

// DELETE /api/gsd/phase — remove a phase via gsd-tools
app.delete('/api/gsd/phase', async (req, res) => {
  const { cwd: cwdParam, phase } = req.body as { cwd?: string; phase?: number };
  if (!cwdParam || phase === undefined) { res.status(400).json({ error: 'cwd and phase required' }); return; }
  const resolvedCwd = path.resolve(cwdParam);
  const gsdTools = path.join(os.homedir(), '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs');
  try {
    await execFileAsync('node', [gsdTools, 'phase', 'remove', String(phase), '--force'], { cwd: resolvedCwd });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/gsd/plan — remove a plan's files and patch ROADMAP.md
app.delete('/api/gsd/plan', async (req, res) => {
  const { cwd: cwdParam, phaseNum, planId } = req.body as { cwd?: string; phaseNum?: number; planId?: string };
  if (!cwdParam || phaseNum === undefined || !planId) { res.status(400).json({ error: 'cwd, phaseNum, planId required' }); return; }
  const resolvedCwd = path.resolve(cwdParam);
  const planningDir = path.join(resolvedCwd, '.planning');
  try {
    const entries = await readdir(path.join(planningDir, 'phases'), { withFileTypes: true });
    const numStr = String(Math.floor(phaseNum)).padStart(2, '0');
    const dirEntry = entries.find(e => e.isDirectory() && e.name.startsWith(numStr + '-'));
    if (dirEntry) {
      const phaseDir = path.join(planningDir, 'phases', dirEntry.name);
      await rm(path.join(phaseDir, `${planId}-PLAN.md`), { force: true });
      await rm(path.join(phaseDir, `${planId}-SUMMARY.md`), { force: true });
    }
    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    try {
      const content = await readFile(roadmapPath, 'utf-8');
      const patched = patchRoadmapRemovePlan(content, phaseNum, planId);
      await writeFile(roadmapPath, patched, 'utf-8');
    } catch { /* ROADMAP.md missing is acceptable */ }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/gsd/quick — remove a quick task dir and patch STATE.md
app.delete('/api/gsd/quick', async (req, res) => {
  const { cwd: cwdParam, dirName, num } = req.body as { cwd?: string; dirName?: string; num?: number };
  if (!cwdParam || !dirName || num === undefined) { res.status(400).json({ error: 'cwd, dirName, num required' }); return; }
  const resolvedCwd = path.resolve(cwdParam);
  const planningDir = path.join(resolvedCwd, '.planning');
  try {
    await rm(path.join(planningDir, 'quick', dirName), { recursive: true, force: true });
    const statePath = path.join(planningDir, 'STATE.md');
    try {
      const content = await readFile(statePath, 'utf-8');
      const rowRe = new RegExp(`^\\| ${num} \\|[^\\n]*\\n?`, 'm');
      await writeFile(statePath, content.replace(rowRe, ''), 'utf-8');
    } catch { /* STATE.md missing is acceptable */ }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/fs — delete a file or directory
app.delete('/api/fs', async (req, res) => {
  const { path: targetPath } = req.body as { path?: string };
  if (!targetPath?.trim()) { res.status(400).json({ error: 'path required' }); return; }
  const resolvedPath = path.resolve(targetPath);
  if (resolvedPath === '/' || resolvedPath === os.homedir()) {
    res.status(403).json({ error: 'Refusing to delete root or home directory' }); return;
  }
  try {
    await rm(resolvedPath, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/fs/dir — create a directory (recursive)
app.post('/api/fs/dir', async (req, res) => {
  const { path: targetPath } = req.body as { path?: string };
  if (!targetPath?.trim()) { res.status(400).json({ error: 'path required' }); return; }
  try {
    await mkdir(path.resolve(targetPath), { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Second Brain API ────────────────────────────────────────────────────────

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content.trim() };
  const meta: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      meta[key] = raw.slice(1, -1);
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      meta[key] = raw.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      meta[key] = raw;
    }
  }
  return { meta, body: match[2].trim() };
}

function serializeFrontmatter(name: string, description: string, type: string, tags: string[], created: string, body: string): string {
  const tagsStr = tags.length ? `[${tags.map(t => `"${t}"`).join(', ')}]` : '[]';
  return `---\nname: "${name}"\ndescription: "${description}"\ntype: "${type}"\ntags: ${tagsStr}\ncreated: "${created}"\n---\n\n${body}`;
}

// GET /api/brain — list all brain entries (metadata only)
app.get('/api/brain', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  const brainDir = path.join(path.resolve(cwd), '.brain');
  try { await fsAccess(brainDir); } catch { res.json({ entries: [] }); return; }
  try {
    const files = (await readdir(brainDir)).filter(f => f.endsWith('.md'));
    const entries = await Promise.all(files.map(async f => {
      const content = await readFile(path.join(brainDir, f), 'utf-8');
      const { meta } = parseFrontmatter(content);
      return {
        id: f.replace(/\.md$/, ''),
        name: (meta.name as string) ?? f.replace(/\.md$/, ''),
        description: (meta.description as string) ?? '',
        type: (meta.type as string) ?? 'note',
        tags: (meta.tags as string[]) ?? [],
        created: (meta.created as string) ?? '',
      };
    }));
    res.json({ entries });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /api/brain/entry — get single brain entry with full body
app.get('/api/brain/entry', async (req, res) => {
  const { cwd, id } = req.query as { cwd?: string; id?: string };
  if (!cwd || !id) { res.status(400).json({ error: 'cwd and id required' }); return; }
  const entryPath = path.join(path.resolve(cwd), '.brain', `${id}.md`);
  try {
    const raw = await readFile(entryPath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);
    res.json({ id, meta, body, raw });
  } catch { res.status(404).json({ error: 'Entry not found' }); }
});

// POST /api/brain — create a new brain entry
app.post('/api/brain', async (req, res) => {
  const { cwd, name, description, type, tags, body } = req.body as {
    cwd?: string; name?: string; description?: string; type?: string; tags?: string[]; body?: string;
  };
  if (!cwd || !name) { res.status(400).json({ error: 'cwd and name required' }); return; }
  const brainDir = path.join(path.resolve(cwd), '.brain');
  await mkdir(brainDir, { recursive: true });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entry';
  const today = new Date().toISOString().slice(0, 10);
  const content = serializeFrontmatter(name, description ?? '', type ?? 'note', tags ?? [], today, body ?? '');
  await writeFile(path.join(brainDir, `${slug}.md`), content, 'utf-8');
  res.json({ ok: true, id: slug });
});

// PUT /api/brain/entry — update an existing brain entry
app.put('/api/brain/entry', async (req, res) => {
  const { cwd, id, name, description, type, tags, body } = req.body as {
    cwd?: string; id?: string; name?: string; description?: string; type?: string; tags?: string[]; body?: string;
  };
  if (!cwd || !id) { res.status(400).json({ error: 'cwd and id required' }); return; }
  const entryPath = path.join(path.resolve(cwd), '.brain', `${id}.md`);
  try {
    const existing = await readFile(entryPath, 'utf-8');
    const { meta } = parseFrontmatter(existing);
    const content = serializeFrontmatter(
      name ?? (meta.name as string) ?? id,
      description ?? (meta.description as string) ?? '',
      type ?? (meta.type as string) ?? 'note',
      tags ?? (meta.tags as string[]) ?? [],
      (meta.created as string) ?? new Date().toISOString().slice(0, 10),
      body ?? '',
    );
    await writeFile(entryPath, content, 'utf-8');
    res.json({ ok: true });
  } catch { res.status(404).json({ error: 'Entry not found' }); }
});

// DELETE /api/brain/entry — delete a brain entry
app.delete('/api/brain/entry', async (req, res) => {
  const { cwd, id } = req.body as { cwd?: string; id?: string };
  if (!cwd || !id) { res.status(400).json({ error: 'cwd and id required' }); return; }
  try {
    await rm(path.join(path.resolve(cwd), '.brain', `${id}.md`), { force: true });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /api/fs/file — create an empty file (fails if already exists)
app.post('/api/fs/file', async (req, res) => {
  const { path: targetPath } = req.body as { path?: string };
  if (!targetPath?.trim()) { res.status(400).json({ error: 'path required' }); return; }
  try {
    await writeFile(path.resolve(targetPath), '', { flag: 'wx' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GSD Super Tool tracking ──────────────────────────────────────────────────

const GSD_TOOLS = path.join(os.homedir(), '.claude/get-shit-done/bin/gsd-tools.cjs');
const PENDING_PHASE_FILE = path.join(os.homedir(), '.config/slopdock/pending-phase.json');

app.post('/api/gsd-track-phase', async (req, res) => {
  const { cwd, name, description } = req.body as {
    cwd?: string; name?: string; description?: string;
  };
  if (!cwd?.trim() || !name?.trim() || !description?.trim()) {
    res.status(400).json({ error: 'cwd, name, and description are required' });
    return;
  }

  try {
    // 1. Add the phase via gsd-tools
    const { stdout } = await execFileAsync('node', [GSD_TOOLS, 'phase', 'add', name, '--cwd', cwd]);
    const { phase_number } = JSON.parse(stdout) as { phase_number: number; padded: string; name: string; slug: string };

    // 2. Patch ROADMAP.md — gsd-tools only writes the Phase Details section;
    //    we also need the Phases summary list entry, progress table row, and a real Goal.
    const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
    let roadmap = await readFile(roadmapPath, 'utf-8');

    // 2a. Replace placeholder Goal with the real description
    roadmap = roadmap.replace(
      /(\n### Phase \d+: [^\n]+\n\n\*\*Goal:\*\*) \[To be planned\]/,
      `$1 ${description}`,
    );

    // 2b. Insert the Phases list entry before ## Phase Details
    const listEntry = `- [ ] **Phase ${phase_number}: ${name}** — ${description.slice(0, 100)}${description.length > 100 ? '…' : ''}`;
    roadmap = roadmap.replace(
      /\n(## Phase Details)/,
      `\n${listEntry}\n\n$1`,
    );

    // 2c. Append progress table row (after the last | row in the table)
    roadmap = roadmap.replace(
      /(\| \d+\. [^\n]+\|[^\n]+\n)(\n|$)/,
      (_, lastRow, after) =>
        `${lastRow}| ${phase_number}. ${name} | — | In Progress | — |\n${after}`,
    );

    await writeFile(roadmapPath, roadmap, 'utf-8');

    // 3. Write pending-phase state so the Stop hook can auto-complete it
    await mkdir(path.dirname(PENDING_PHASE_FILE), { recursive: true });
    await writeFile(PENDING_PHASE_FILE, JSON.stringify({ cwd, phaseNumber: phase_number }), 'utf-8');

    res.json({ ok: true, phaseNumber: phase_number });
  } catch (err) {
    console.error('gsd-track-phase error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/git-unpushed — list commits not yet pushed to remote
app.get('/api/git-unpushed', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  try {
    const { stdout } = await execFileAsync('git', [
      '-C', path.resolve(cwd),
      'log', '@{u}..HEAD',
      '--pretty=format:%h\t%s',
    ]);
    const lines = stdout.split('\n').filter(Boolean);
    const commits = lines.map(line => {
      const tabIdx = line.indexOf('\t');
      return { hash: line.slice(0, tabIdx), message: line.slice(tabIdx + 1) };
    });
    res.json({ commits });
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('@{u}') || errStr.includes('no upstream') || errStr.includes('no tracking')) {
      res.json({ commits: [], noUpstream: true });
    } else {
      res.json({ commits: [], error: errStr });
    }
  }
});

// POST /api/git-push — push current branch to remote
app.post('/api/git-push', async (req, res) => {
  const { cwd } = req.body as { cwd?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  try {
    await execFileAsync('git', ['-C', path.resolve(cwd), 'push']);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: String(err) });
  }
});

// GET /api/rules — load CLAUDE.md files (global + project hierarchy) with @-import resolution
function parseAtImports(content: string): string[] {
  const imports: string[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('@')) continue;
    let p = trimmed.slice(1);
    if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
    if (path.isAbsolute(p) && p.endsWith('.md')) imports.push(p);
  }
  return [...new Set(imports)];
}

app.get('/api/rules', async (req, res) => {
  const cwd = typeof req.query.cwd === 'string' ? req.query.cwd : null;
  interface RuleFile { id: string; path: string; displayPath: string; scope: 'global' | 'project' | 'import'; parentId?: string; content: string; imports: string[]; }
  const files: RuleFile[] = [];
  const seen = new Set<string>();

  const tryRead = async (filePath: string, id: string, scope: 'global' | 'project' | 'import', parentId?: string) => {
    if (seen.has(filePath)) return;
    seen.add(filePath);
    try {
      const content = await readFile(filePath, 'utf-8');
      const displayPath = filePath.startsWith(os.homedir()) ? '~' + filePath.slice(os.homedir().length) : filePath;
      const imports = parseAtImports(content);
      files.push({ id, path: filePath, displayPath, scope, parentId, content, imports });
    } catch { /* file not found */ }
  };

  const globalMd = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  await tryRead(globalMd, 'global', 'global');

  if (cwd) {
    const cwdResolved = path.resolve(cwd);
    let dir = cwdResolved;
    let depth = 0;
    while (depth < 5) {
      const candidate = path.join(dir, 'CLAUDE.md');
      const relOrAbs = dir === cwdResolved ? 'CLAUDE.md' : candidate;
      await tryRead(candidate, `project-${depth}`, 'project');
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
      depth++;
    }
  }

  const importParents = new Map<string, string>();
  for (const f of [...files]) {
    for (const imp of f.imports) {
      if (!importParents.has(imp)) importParents.set(imp, f.id);
    }
  }
  for (const [impPath, parentId] of importParents) {
    await tryRead(impPath, `import-${impPath}`, 'import', parentId);
  }

  res.json({ files });
});

app.get('/api/slop-status', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  const slopDir = path.join(path.resolve(cwd), '.slop');
  const configFile = path.join(slopDir, 'config.json');
  try {
    await fsAccess(slopDir);
    try {
      const raw = await readFile(configFile, 'utf-8');
      res.json({ exists: true, config: JSON.parse(raw) });
    } catch {
      res.json({ exists: true, config: null });
    }
  } catch {
    res.json({ exists: false, config: null });
  }
});

app.post('/api/slop-init', async (req, res) => {
  const { cwd, projectName } = req.body as { cwd?: string; projectName?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  const slopDir = path.join(path.resolve(cwd), '.slop');
  const configFile = path.join(slopDir, 'config.json');
  await mkdir(slopDir, { recursive: true });
  const config = {
    version: '1',
    created: new Date().toISOString(),
    projectName: projectName ?? path.basename(path.resolve(cwd)),
    agent: { command: 'claude', args: [], label: 'Claude' },
  };
  await atomicWrite(configFile, JSON.stringify(config, null, 2));
  res.json({ ok: true, config });
});

app.get('/api/global-settings', async (_req, res) => {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8');
    res.json({ settings: JSON.parse(raw) });
  } catch {
    res.json({ settings: null });
  }
});

app.put('/api/global-settings', async (req, res) => {
  const { settings } = req.body as { settings?: unknown };
  if (!settings) { res.status(400).json({ error: 'settings required' }); return; }
  await mkdir(SLOP_DIR, { recursive: true });
  await atomicWrite(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  res.json({ ok: true });
});

app.get('/api/vault-status', async (_req, res) => {
  const results = await Promise.all(VAULT_TARGETS.map(async (t) => {
    let sourceExists = false, backupExists = false, inSync = false, lastBackup: string | null = null;
    try { await fsAccess(t.src); sourceExists = true; } catch { /* missing */ }
    try {
      const bkStat = await stat(t.dest);
      backupExists = true;
      lastBackup = new Date(bkStat.mtimeMs).toISOString();
      if (sourceExists) {
        const srcStat = await stat(t.src);
        inSync = srcStat.mtimeMs <= bkStat.mtimeMs;
      }
    } catch { /* no backup */ }
    return { id: t.id, src: t.src, dest: t.dest, sourceExists, backupExists, inSync, lastBackup };
  }));
  res.json({ targets: results });
});

app.post('/api/vault-backup', async (req, res) => {
  const { targets: targetIds } = req.body as { targets?: string[] };
  const toBackup = targetIds
    ? VAULT_TARGETS.filter(t => targetIds.includes(t.id))
    : [...VAULT_TARGETS];
  const results = await Promise.all(toBackup.map(async (t) => {
    try {
      await mkdir(path.dirname(t.dest), { recursive: true });
      const content = await readFile(t.src, 'utf-8');
      await atomicWrite(t.dest, content);
      return { id: t.id, ok: true };
    } catch (e) {
      return { id: t.id, ok: false, error: String(e) };
    }
  }));
  res.json({ results });
});

app.post('/api/vault-restore', async (req, res) => {
  const { targets: targetIds } = req.body as { targets?: string[] };
  if (!Array.isArray(targetIds)) { res.status(400).json({ error: 'targets array required' }); return; }
  const toRestore = VAULT_TARGETS.filter(t => targetIds.includes(t.id));
  const results = await Promise.all(toRestore.map(async (t) => {
    try {
      await mkdir(path.dirname(t.src), { recursive: true });
      const content = await readFile(t.dest, 'utf-8');
      await atomicWrite(t.src, content);
      return { id: t.id, ok: true };
    } catch (e) {
      return { id: t.id, ok: false, error: String(e) };
    }
  }));
  res.json({ results });
});

app.get('/api/recent-paths', async (_req, res) => {
  try {
    const raw = await readFile(RECENTS_FILE, 'utf-8');
    const { paths } = JSON.parse(raw) as { paths: string[] };
    res.json({ paths: paths ?? [] });
  } catch {
    res.json({ paths: [] });
  }
});

app.put('/api/recent-paths', async (req, res) => {
  const { paths } = req.body as { paths?: string[] };
  if (!Array.isArray(paths)) { res.status(400).json({ error: 'paths array required' }); return; }
  await mkdir(SLOP_DIR, { recursive: true });
  await atomicWrite(RECENTS_FILE, JSON.stringify({ version: '1', paths }, null, 2));
  res.json({ ok: true });
});

// POST /api/vault-git — init, commit, or clone ~/.slop as a git repo
app.post('/api/vault-git', async (req, res) => {
  const { action, remote } = req.body as { action?: string; remote?: string };
  try {
    await mkdir(SLOP_DIR, { recursive: true });
    if (action === 'init') {
      await execFileAsync('git', ['-C', SLOP_DIR, 'init']);
      await execFileAsync('git', ['-C', SLOP_DIR, 'add', '-A']);
      try { await execFileAsync('git', ['-C', SLOP_DIR, 'commit', '-m', 'init']); } catch { /* nothing to commit */ }
      res.json({ ok: true, message: 'Git repo initialized in ~/.slop' });
    } else if (action === 'pull') {
      const { stdout } = await execFileAsync('git', ['-C', SLOP_DIR, 'pull']);
      res.json({ ok: true, message: stdout.trim() || 'Already up to date.' });
    } else if (action === 'clone' && remote) {
      // Clone into a temp dir then merge into SLOP_DIR
      const tmpClone = SLOP_DIR + '_clone_tmp';
      try { await rm(tmpClone, { recursive: true, force: true }); } catch {}
      await execFileAsync('git', ['clone', remote, tmpClone]);
      // Copy files from clone into SLOP_DIR (non-destructive merge)
      const { stdout: fileList } = await execFileAsync('bash', ['-c', `find "${tmpClone}" -not -path "*/.git/*" -not -name ".git" -type f`]);
      const files = fileList.trim().split('\n').filter(Boolean);
      for (const f of files) {
        const rel = f.slice(tmpClone.length);
        const dest = SLOP_DIR + rel;
        await mkdir(path.dirname(dest), { recursive: true });
        await execFileAsync('cp', [f, dest]);
      }
      await rm(tmpClone, { recursive: true, force: true });
      res.json({ ok: true, message: `Synced ${files.length} files from remote.` });
    } else {
      res.status(400).json({ error: 'action must be init, pull, or clone (with remote)' });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Attach WebSocket server
attachWebSocketServer(server);

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`SlopDock server listening on :${PORT}`);
  // Start Piper TTS and probe Whisper STT in background — non-blocking
  initPiper().catch(() => {});
  checkWhisper().catch(() => {});
  autoBackupVault().catch(() => {});
});
