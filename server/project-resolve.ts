import { readdir, stat } from 'fs/promises';
import path from 'path';

export type ResolveProjectResult =
  | { ok: true; absolutePath: string }
  | { ok: false; error: string };

/**
 * Resolve a unique project folder name under configured roots (recursive, bounded depth).
 */
export async function resolveProjectFolderName(
  name: string,
  projectRoots: string[],
  maxDepth: number,
): Promise<ResolveProjectResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Project name is empty.' };
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed === '.' || trimmed === '..') {
    return { ok: false, error: 'Use a plain folder name only (no paths).' };
  }

  const hits: string[] = [];
  for (const root of projectRoots) {
    const absRoot = path.resolve(root);
    try {
      const st = await stat(absRoot);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    await collectDirsNamed(absRoot, trimmed, 0, maxDepth, hits);
  }

  const unique = [...new Set(hits)];
  if (unique.length === 0) {
    return { ok: false, error: `Unknown project "${trimmed}" under configured roots.` };
  }
  if (unique.length > 1) {
    return {
      ok: false,
      error: `Ambiguous project "${trimmed}" (${unique.length} matches). First: ${unique.slice(0, 3).join(', ')}`,
    };
  }
  return { ok: true, absolutePath: unique[0]! };
}

async function collectDirsNamed(
  dir: string,
  targetName: string,
  depth: number,
  maxDepth: number,
  out: string[],
): Promise<void> {
  if (depth > maxDepth) return;
  let entries: import('fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    if (e.name === targetName) out.push(full);
    await collectDirsNamed(full, targetName, depth + 1, maxDepth, out);
  }
}

/** Escape a path for use inside single quotes in sh / bash (e.g. cd '…'). */
export function shellSingleQuotedPath(absPath: string): string {
  return "'" + absPath.replace(/'/g, "'\\''") + "'";
}
