import path from 'path';
import os from 'os';
import { readFile, writeFile, mkdir, chmod, rename } from 'fs/promises';

export const TELEGRAM_CONFIG_PATH = path.join(os.homedir(), '.slop', 'telegram.json');
export const TELEGRAM_SECRETS_PATH = path.join(os.homedir(), '.slop', 'telegram-secrets.json');

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}

function shortenHome(abs: string): string {
  const h = os.homedir();
  if (abs.startsWith(h + path.sep) || abs === h) return '~' + abs.slice(h.length);
  return abs;
}

/** Runtime token: env wins, then ~/.slop/telegram-secrets.json */
export async function getTelegramBotToken(): Promise<string | undefined> {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  try {
    const raw = await readFile(TELEGRAM_SECRETS_PATH, 'utf-8');
    const j = JSON.parse(raw) as { botToken?: string };
    const t = j.botToken?.trim();
    return t || undefined;
  } catch {
    return undefined;
  }
}

export type TelegramUiState = {
  projectRootsText: string;
  allowedUserIdsText: string;
  maxSearchDepth: number;
  tokenConfigured: boolean;
  tokenSource: 'env' | 'file' | 'none';
};

export async function readTelegramUiState(): Promise<TelegramUiState> {
  const envToken = !!process.env.TELEGRAM_BOT_TOKEN?.trim();
  let fileToken = false;
  if (!envToken) {
    try {
      const raw = await readFile(TELEGRAM_SECRETS_PATH, 'utf-8');
      const j = JSON.parse(raw) as { botToken?: string };
      fileToken = !!j.botToken?.trim();
    } catch {
      /* no secrets file */
    }
  }

  let file: { projectRoots?: string[]; allowedUserIds?: number[]; maxSearchDepth?: number } = {};
  try {
    const raw = await readFile(TELEGRAM_CONFIG_PATH, 'utf-8');
    file = JSON.parse(raw) as typeof file;
  } catch {
    /* missing */
  }

  const rootsRaw = file.projectRoots ?? [];
  const rootsText = rootsRaw.map((r) => shortenHome(path.resolve(r))).join('\n');
  const idsText = (file.allowedUserIds ?? []).join(', ');
  let depth = typeof file.maxSearchDepth === 'number' ? file.maxSearchDepth : 8;
  if (depth < 0 || depth > 32) depth = 8;

  return {
    projectRootsText: rootsText,
    allowedUserIdsText: idsText,
    maxSearchDepth: depth,
    tokenConfigured: envToken || fileToken,
    tokenSource: envToken ? 'env' : fileToken ? 'file' : 'none',
  };
}

export async function saveTelegramPublicConfig(body: {
  projectRootsText: string;
  allowedUserIdsText: string;
  maxSearchDepth?: number;
}): Promise<void> {
  await mkdir(path.dirname(TELEGRAM_CONFIG_PATH), { recursive: true });
  const roots = body.projectRootsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((r) => (r.startsWith('~') ? path.join(os.homedir(), r.slice(1)) : path.resolve(r)));

  const ids = body.allowedUserIdsText
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  let depth = body.maxSearchDepth;
  if (typeof depth !== 'number' || Number.isNaN(depth) || depth < 0 || depth > 32) depth = 8;

  const json = JSON.stringify({ projectRoots: roots, allowedUserIds: ids, maxSearchDepth: depth }, null, 2);
  await atomicWrite(TELEGRAM_CONFIG_PATH, json);
}

/** Persist token to disk (ignored at runtime if TELEGRAM_BOT_TOKEN is set). Pass null/empty to clear file token. */
export async function saveTelegramBotToken(token: string | null | undefined): Promise<void> {
  await mkdir(path.dirname(TELEGRAM_SECRETS_PATH), { recursive: true });
  const trimmed = token?.trim();
  const json = trimmed ? JSON.stringify({ botToken: trimmed }, null, 2) : JSON.stringify({}, null, 2);
  await atomicWrite(TELEGRAM_SECRETS_PATH, json);
  try {
    await chmod(TELEGRAM_SECRETS_PATH, 0o600);
  } catch {
    /* Windows or permission */
  }
}
