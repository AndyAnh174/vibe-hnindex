/**
 * Fast file hash for change detection (v0.9.1)
 *
 * Uses SHA-1 instead of SHA-256 for deduplication (~2x faster,
 * still sufficient for detecting file changes in codebases).
 * Supports mtime+size pre-check to skip hash computation entirely
 * when the file hasn't been touched since last index.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Compute a fast hash of file content for change detection.
 * SHA-1 is ~2x faster than SHA-256 and perfectly adequate for
 * detecting whether a code file has changed between index runs.
 */
export function fastHash(content: string | Buffer): string {
  return crypto.createHash('sha1').update(content).digest('hex');
}

/**
 * Check if a file is likely unchanged using mtime + size as a pre-filter.
 * Returns `true` if the file is likely unchanged, `false` if it needs full hashing.
 *
 * This is a fast pre-check: if both mtime and size match the cached values,
 * we skip the relatively expensive content hash. The cached values come from
 * the SQLite projects table (stored during the first index_codebase run).
 */
export function mtimeSizeMatch(
  filePath: string,
  cachedMtimeMs: number | null,
  cachedSize: number | null,
): boolean {
  if (cachedMtimeMs === null || cachedSize === null) return false;
  try {
    const stat = fs.statSync(filePath);
    return stat.mtimeMs === cachedMtimeMs && stat.size === cachedSize;
  } catch {
    return false;
  }
}

/**
 * Store mtime+size+hash for a file after successful indexing.
 * Used to avoid full hashing on the next index run.
 */
export interface FileFingerprint {
  mtimeMs: number;
  size: number;
  hash: string;
}

/**
 * Read a file's fingerprint (mtime + size) without reading content.
 */
export function readFileFingerprint(filePath: string): { mtimeMs: number; size: number } | null {
  try {
    const stat = fs.statSync(filePath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return null;
  }
}
