export type ClientMessage =
  | { type: 'start'; cwd: string; cols: number; rows: number; agentCommand: string; agentArgs: string[] }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'kill' };

export type ServerMessage =
  | { type: 'data'; data: string }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string };
