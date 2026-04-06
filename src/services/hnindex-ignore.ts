import fs from 'node:fs';
import path from 'node:path';
import { minimatch } from 'minimatch';

export const HNINDEX_IGNORE_FILENAME = '.hnindexignore';

/**
 * Parse .hnindexignore body: blank lines and # comments skipped; no `!` negation in v1.
 */
export function parseHnindexIgnoreContent(content: string): string[] {
  const patterns: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    patterns.push(t);
  }
  return patterns;
}

export function loadHnindexIgnore(rootPath: string): string[] {
  const abs = path.join(path.resolve(rootPath), HNINDEX_IGNORE_FILENAME);
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return [];
    const content = fs.readFileSync(abs, 'utf-8');
    return parseHnindexIgnoreContent(content);
  } catch {
    return [];
  }
}

/**
 * Gitignore-like matching: patterns with `/` are relative to root; patterns without `/`
 * match any path segment (also under subdirs).
 */
export function matchesHnindexPattern(relativePath: string, pattern: string): boolean {
  const p = relativePath.replace(/\\/g, '/').replace(/^\//, '');
  const pat = pattern.trim();
  if (!pat) return false;

  const opts = { dot: true } as const;

  // Trailing `/` = ignore whole directory tree (gitignore-style)
  if (pat.endsWith('/')) {
    const dir = pat.slice(0, -1).replace(/\/+$/, '') || pat;
    if (minimatch(p, `${dir}/**`, opts)) return true;
    if (minimatch(p, `**/${dir}/**`, opts)) return true;
  }

  if (minimatch(p, pat, opts)) return true;

  if (!pat.includes('/')) {
    if (minimatch(p, `**/${pat}`, opts)) return true;
    if (minimatch(p, `**/${pat}/**`, opts)) return true;
    if (minimatch(p, `${pat}/**`, opts)) return true;
  }

  return false;
}

export function isIgnored(relativePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  for (const pattern of patterns) {
    if (matchesHnindexPattern(relativePath, pattern)) return true;
  }
  return false;
}
