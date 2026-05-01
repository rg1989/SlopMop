import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import * as pty from 'node-pty';
import { spawnSession, resizeSession } from './pty-manager.js';
import type { ClientMessage, ServerMessage } from '../shared/protocol.js';

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let ptyProcess: pty.IPty | null = null;

    function send(msg: ServerMessage): void {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch (err) {
        send({ type: 'error', message: 'Invalid JSON message' });
        return;
      }

      if (msg.type === 'start') {
        if (ptyProcess) {
          // Kill existing session before starting new one
          try {
            ptyProcess.kill();
          } catch {
            // ignore
          }
        }
        try {
          ptyProcess = spawnSession(msg.cwd, msg.cols, msg.rows, msg.agentCommand, msg.agentArgs);
          // Echo session-ready so clients can confirm the session is live
          send({ type: 'session-ready', sessionId: msg.sessionId });
          ptyProcess.onData((data: string) => {
            send({ type: 'data', data });
          });
          ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
            send({ type: 'exit', code: exitCode });
            ptyProcess = null;
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          send({ type: 'error', message: `Failed to start session: ${message}` });
        }
      } else if (msg.type === 'input') {
        if (ptyProcess) {
          ptyProcess.write(msg.data);
        }
      } else if (msg.type === 'resize') {
        if (ptyProcess) {
          resizeSession(ptyProcess, msg.cols, msg.rows);
        }
      } else if (msg.type === 'kill') {
        if (ptyProcess) {
          try {
            ptyProcess.kill();
          } catch {
            // ignore
          }
          ptyProcess = null;
        }
      }
    });

    ws.on('close', () => {
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch {
          // ignore
        }
        ptyProcess = null;
      }
    });

    ws.on('error', (err: Error) => {
      console.error('[ws-handler] WebSocket error:', err.message);
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch {
          // ignore
        }
        ptyProcess = null;
      }
    });
  });

  console.log('[ws-handler] WebSocket server attached at /ws');
}
