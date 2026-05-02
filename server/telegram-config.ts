import { readFile } from 'fs/promises';
import path from 'path';
import os from 'os';

export interface TelegramSlopFileConfig {
  /** Absolute or ~ paths; resolved at load time */
  projectRoots?: string[];
  /** Numeric Telegram user IDs allowed to use the bot (private chats). */
  allowedUserIds?: number[];
  maxSearchDepth?: number;
}

const DEFAULT_DEPTH = 8;

function parseIdList(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseRootList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((r) => (r.startsWith('~') ? path.join(os.homedir(), r.slice(1)) : path.resolve(r)));
}

function expandPath(p: string): string {
  const t = p.trim();
  if (!t) return t;
  return t.startsWith('~') ? path.join(os.homedir(), t.slice(1)) : path.resolve(t);
}

export type LoadedTelegramConfig = {
  projectRoots: string[];
  allowedUserIds: number[];
  maxSearchDepth: number;
};

export async function loadTelegramConfig(filePath: string): Promise<LoadedTelegramConfig> {
  let file: TelegramSlopFileConfig = {};
  try {
    const raw = await readFile(filePath, 'utf-8');
    file = JSON.parse(raw) as TelegramSlopFileConfig;
  } catch {
    // missing or invalid — fall through to env-only
  }

  const envRoots = parseRootList(process.env.TELEGRAM_PROJECT_ROOTS);
  const envIds = parseIdList(process.env.TELEGRAM_ALLOWED_USER_IDS);

  const rootsFromFile = (file.projectRoots ?? []).map(expandPath).filter(Boolean);
  const idsFromFile = (file.allowedUserIds ?? []).filter((n) => Number.isFinite(n) && n > 0);

  const projectRoots = envRoots.length > 0 ? envRoots : rootsFromFile;
  const allowedUserIds = envIds.length > 0 ? envIds : idsFromFile;
  const maxSearchDepth =
    typeof file.maxSearchDepth === 'number' && file.maxSearchDepth >= 0 && file.maxSearchDepth <= 32
      ? file.maxSearchDepth
      : DEFAULT_DEPTH;

  return { projectRoots, allowedUserIds, maxSearchDepth };
}
