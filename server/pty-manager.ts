import * as pty from 'node-pty';
import { execSync } from 'child_process';

function getLoginShellPath(): string {
  try {
    return execSync('/bin/bash -lc "echo $PATH"').toString().trim();
  } catch {
    return process.env.PATH ?? '';
  }
}

const LOGIN_PATH = getLoginShellPath();

export function spawnSession(cwd: string, cols: number, rows: number): pty.IPty {
  return pty.spawn('claude', [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      PATH: LOGIN_PATH,
      TERM: 'xterm-256color',
    },
  });
}

export function resizeSession(ptyProcess: pty.IPty, cols: number, rows: number): void {
  ptyProcess.resize(cols, rows);
}
