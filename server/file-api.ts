import { readdir } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export interface FileNode {
  name: string;
  path: string; // absolute path
  type: 'file' | 'dir';
  children?: FileNode[];
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '__pycache__',
  'coverage',
]);

export async function buildFileTree(root: string, depth = 0): Promise<FileNode[]> {
  if (depth >= 8) return [];

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: FileNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    const name = entry.name;

    // Skip dotfiles/dotdirs except .env
    if (name.startsWith('.') && name !== '.env') continue;

    const absPath = path.join(root, name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      const children = await buildFileTree(absPath, depth + 1);
      dirs.push({ name, path: absPath, type: 'dir', children });
    } else if (entry.isFile()) {
      files.push({ name, path: absPath, type: 'file' });
    }
  }

  // Sort each group alphabetically
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
}

export async function getGitChangedPaths(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
    const lines = stdout.split('\n').filter((l) => l.length > 0);
    const paths: string[] = [];

    for (const line of lines) {
      // Porcelain v1: "XY relpath" — relpath starts at index 3
      let relPath = line.slice(3);

      // Handle rename format: "old -> new"
      if (relPath.includes(' -> ')) {
        relPath = relPath.split(' -> ').pop()!;
      }

      // Strip surrounding double-quotes (git wraps paths with spaces)
      if (relPath.startsWith('"') && relPath.endsWith('"')) {
        relPath = relPath.slice(1, -1);
      }

      paths.push(path.join(cwd, relPath));
    }

    return paths;
  } catch {
    // Not a git repo or git not found — return empty array
    return [];
  }
}
