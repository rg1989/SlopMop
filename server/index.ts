import express from 'express';
import { createServer } from 'http';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { isBinaryFile } from 'isbinaryfile';
import { attachWebSocketServer } from './ws-handler.js';
import { buildFileTree, getGitChangedPaths } from './file-api.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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

// GET /api/git-status — return array of absolute paths for git-changed files
app.get('/api/git-status', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) {
    res.status(400).json({ error: 'cwd required' });
    return;
  }
  const changed = await getGitChangedPaths(path.resolve(cwd));
  res.json({ changed });
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

// Attach WebSocket server
attachWebSocketServer(server);

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`ClaudeTalk server listening on :${PORT}`);
});
