import type * as pty from 'node-pty';
import type { ServerMessage } from '../shared/protocol.js';

type SendFn = (msg: ServerMessage) => void;

interface ManagedSession {
  id: string;
  pty: pty.IPty | null;
  cwd: string;
  status: 'alive' | 'exited';
  exitCode?: number;
  buffer: string[];
  sendFn: SendFn | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  /** When true, WebSocket detach does not clear delivery or start TTL (e.g. Telegram-backed sessions). */
  persistent: boolean;
}

const BUFFER_MAX = 5000;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class SessionRegistry {
  private sessions = new Map<string, ManagedSession>();

  create(id: string, ptyProcess: pty.IPty, cwd: string, sendFn: SendFn, options?: { persistent?: boolean }): void {
    const existing = this.sessions.get(id);
    if (existing?.cleanupTimer) clearTimeout(existing.cleanupTimer);
    const persistent = options?.persistent === true;
    this.sessions.set(id, {
      id, pty: ptyProcess, cwd, status: 'alive',
      buffer: [], sendFn, cleanupTimer: null,
      persistent,
    });
  }

  get(id: string): ManagedSession | undefined {
    return this.sessions.get(id);
  }

  attach(id: string, sendFn: SendFn): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }
    session.sendFn = sendFn;
  }

  detach(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.persistent) return;
    session.sendFn = null;
    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
    session.cleanupTimer = setTimeout(() => {
      this.destroy(id);
    }, SESSION_TTL_MS);
  }

  destroy(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
    if (session.pty) {
      try { session.pty.kill(); } catch {}
      session.pty = null;
    }
    this.sessions.delete(id);
    console.log(`[registry] Session ${id} destroyed`);
  }

  appendBuffer(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.buffer.push(data);
    if (session.buffer.length > BUFFER_MAX) {
      session.buffer.splice(0, session.buffer.length - BUFFER_MAX);
    }
  }

  getBuffer(id: string): string {
    const session = this.sessions.get(id);
    return session ? session.buffer.join('') : '';
  }

  markExited(id: string, exitCode: number): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.status = 'exited';
    session.exitCode = exitCode;
    session.pty = null;
    // Keep the session in registry for replay; start cleanup timer
    this.detach(id);
  }

  send(id: string, msg: ServerMessage): void {
    const session = this.sessions.get(id);
    session?.sendFn?.(msg);
  }
}

export const registry = new SessionRegistry();
