import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

const INBOUND_ROOT = path.join(os.homedir(), '.slop', 'telegram-inbound');

/** Max download size for Telegram files / voice (bytes). */
export const MAX_TELEGRAM_FILE_BYTES = 25 * 1024 * 1024;

function safeBasename(name: string): string {
  const b = path.basename(name.trim());
  const cleaned = b.replace(/[^a-zA-Z0-9._\-\s]/g, '_').replace(/\s+/g, '_').slice(0, 180);
  return cleaned || 'file';
}

/** Download file bytes only (e.g. voice → Whisper, no disk retention). */
export async function fetchTelegramFileBuffer(opts: {
  botToken: string;
  telegramFilePath: string;
  knownSize?: number;
}): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  const { botToken, telegramFilePath, knownSize } = opts;
  if (knownSize != null && knownSize > MAX_TELEGRAM_FILE_BYTES) {
    return { ok: false, error: `File too large (max ${Math.round(MAX_TELEGRAM_FILE_BYTES / (1024 * 1024))} MB).` };
  }
  const url = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Download failed' };
  }
  if (!res.ok) return { ok: false, error: `Telegram download HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_TELEGRAM_FILE_BYTES) return { ok: false, error: 'File too large after download.' };
  return { ok: true, buffer: buf };
}

/**
 * Download a Telegram file by bot token + path from getFile().file_path.
 */
export async function saveTelegramFileToInbound(opts: {
  botToken: string;
  telegramFilePath: string;
  chatId: number;
  suggestedName: string;
  knownSize?: number;
}): Promise<{ ok: true; absolutePath: string } | { ok: false; error: string }> {
  const { botToken, telegramFilePath, chatId, suggestedName, knownSize } = opts;
  if (knownSize != null && knownSize > MAX_TELEGRAM_FILE_BYTES) {
    return { ok: false, error: `File too large (max ${Math.round(MAX_TELEGRAM_FILE_BYTES / (1024 * 1024))} MB).` };
  }

  const url = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Download failed' };
  }
  if (!res.ok) return { ok: false, error: `Telegram download HTTP ${res.status}` };

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_TELEGRAM_FILE_BYTES) {
    return { ok: false, error: 'File too large after download.' };
  }

  const dir = path.join(INBOUND_ROOT, String(chatId));
  await mkdir(dir, { recursive: true });

  const base = safeBasename(suggestedName);
  const extFromTg = path.extname(telegramFilePath) || '';
  const ext = path.extname(base) || extFromTg || '';
  const stem = ext ? base.slice(0, -ext.length) : base;
  const finalName = `${randomUUID().slice(0, 10)}_${stem || 'file'}${ext}`;
  const abs = path.join(dir, finalName);
  await writeFile(abs, buf);
  return { ok: true, absolutePath: path.resolve(abs) };
}
