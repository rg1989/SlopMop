import express from 'express';
import { createServer } from 'http';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { readFile, writeFile, access as fsAccess, readdir, rm, mkdir } from 'fs/promises';
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

// ── GSD Roadmap helpers ────────────────────────────────────────────────────

function parseRoadmapMd(content: string) {
  const lines = content.split('\n');
  type PhaseDraft = {
    number: number; name: string; goal: string; completed: boolean;
    plans: Array<{ file: string; name: string; completed: boolean }>;
  };
  const phases: PhaseDraft[] = [];
  let inPhasesSection = false;
  let currentPhase: PhaseDraft | null = null;
  let inPlans = false;

  for (const line of lines) {
    if (/^## Phases/.test(line)) { inPhasesSection = true; continue; }
    if (/^## /.test(line) && !/^## Phases/.test(line)) { inPhasesSection = false; }

    if (inPhasesSection) {
      const m = line.match(/^- \[([x ])\] \*\*Phase (\d+(?:\.\d+)?): ([^*]+)\*\*/);
      if (m) phases.push({ number: parseFloat(m[2]), name: m[3].trim(), goal: '', completed: m[1] === 'x', plans: [] });
    }

    const detailM = line.match(/^### Phase (\d+(?:\.\d+)?): /);
    if (detailM) {
      currentPhase = phases.find(p => p.number === parseFloat(detailM[1])) ?? null;
      inPlans = false;
      continue;
    }

    if (currentPhase) {
      const goalM = line.match(/^\*\*Goal\*\*: (.+)/);
      if (goalM) { currentPhase.goal = goalM[1].trim(); }
      if (line.trim() === 'Plans:') { inPlans = true; continue; }
      if (inPlans) {
        if (!line.startsWith('- ')) { inPlans = false; continue; }
        const planM = line.match(/^- \[([x ])\] (\S+\.md) — (.+)/);
        if (planM) currentPhase.plans.push({ file: planM[2].trim(), name: planM[3].trim(), completed: planM[1] === 'x' });
      }
    }
  }
  return phases;
}

function parseStateMd(content: string) {
  const fmM = content.match(/^---\n([\s\S]+?)\n---/);
  const fm = fmM?.[1] ?? '';
  const str = (re: RegExp) => (fm.match(re)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  const num = (re: RegExp) => parseInt((fm.match(re)?.[1] ?? '0'));

  const quickTasks: Array<{ number: number; description: string; date: string; dirPath: string }> = [];
  const tableRe = /^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gm;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(content)) !== null) {
    const n = parseInt(m[1]);
    if (isNaN(n)) continue;
    const pathM = m[5].match(/\(([^)]+)\)/);
    quickTasks.push({ number: n, description: m[2].trim(), date: m[3].trim(), dirPath: pathM?.[1] ?? '' });
  }

  return {
    milestone: str(/^milestone:\s*(.+)$/m),
    milestoneName: str(/^milestone_name:\s*(.+)$/m),
    status: str(/^status:\s*(.+)$/m),
    progress: {
      totalPhases: num(/total_phases:\s*(\d+)/m),
      completedPhases: num(/completed_phases:\s*(\d+)/m),
      totalPlans: num(/total_plans:\s*(\d+)/m),
      completedPlans: num(/completed_plans:\s*(\d+)/m),
      percent: num(/percent:\s*(\d+)/m),
    },
    quickTasks,
  };
}

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
      const summaryPath = absPhaseDir ? path.join(absPhaseDir, plan.file.replace('-PLAN.md', '-SUMMARY.md')) : null;
      // SUMMARY.md existing on disk is an authoritative completion signal
      let completed = plan.completed;
      if (!completed && summaryPath) {
        try { await fsAccess(summaryPath); completed = true; } catch { /* not present */ }
      }
      return {
        id: planId,
        name: plan.name,
        completed,
        planPath: absPhaseDir ? path.join(absPhaseDir, plan.file) : null,
        summaryPath,
      };
    }));

    return {
      number: p.number,
      name: p.name,
      goal: p.goal,
      completed: p.completed,
      dirName,
      researchPath: absPhaseDir ? path.join(absPhaseDir, `${numStr}-RESEARCH.md`) : null,
      verificationPath: absPhaseDir ? path.join(absPhaseDir, `${numStr}-VERIFICATION.md`) : null,
      plans,
    };
  }));

  const completedNums = new Set(stateData.quickTasks.map(q => q.number));
  const quickTasks = quickDirNames.map(dirName => {
    const num = parseInt(dirName);
    const stateTask = stateData.quickTasks.find(q => q.number === num);
    return {
      number: num,
      description: stateTask?.description ?? dirName.replace(/^\d+-/, '').replace(/-/g, ' '),
      date: stateTask?.date ?? '',
      completed: completedNums.has(num),
      dirName,
      planPath: path.join(planningDir, 'quick', dirName, `${num}-PLAN.md`),
    };
  });

  res.json({ exists: true, milestone: stateData.milestone, milestoneName: stateData.milestoneName, status: stateData.status, progress: stateData.progress, phases, quickTasks });
});

// ── FS mutation helpers ────────────────────────────────────────────────────

function escRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function patchRoadmapRemovePlan(content: string, phaseNum: number, planId: string): string {
  const planLineRe = new RegExp(`^- \\[[ x]\\] ${escRe(planId)}-PLAN\\.md[^\\n]*\\n?`, 'm');
  let updated = content.replace(planLineRe, '');
  const countRe = new RegExp(`(### Phase ${phaseNum}[^\\d][\\s\\S]*?\\*\\*Plans\\*\\*: )(\\d+)( plans)`);
  updated = updated.replace(countRe, (_, pre, n, post) => `${pre}${Math.max(0, parseInt(n) - 1)}${post}`);
  return updated;
}

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
const PENDING_PHASE_FILE = path.join(os.homedir(), '.config/claudetalk/pending-phase.json');

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

// Attach WebSocket server
attachWebSocketServer(server);

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`ClaudeTalk server listening on :${PORT}`);
  // Start Piper TTS and probe Whisper STT in background — non-blocking
  initPiper().catch(() => {});
  checkWhisper().catch(() => {});
});
