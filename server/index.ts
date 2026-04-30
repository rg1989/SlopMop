import express from 'express';
import { createServer } from 'http';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { attachWebSocketServer } from './ws-handler.js';

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

app.get('/api/homedir', (_req, res) => {
  res.json({ path: os.homedir() });
});

// Attach WebSocket server
attachWebSocketServer(server);

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`ClaudeTalk server listening on :${PORT}`);
});
