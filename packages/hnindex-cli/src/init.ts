import fs from 'node:fs';
import path from 'node:path';
import { defaultEnv, defaultServerBlock } from './constants.js';
import { mergeServerEntry } from './merge-config.js';
import { listTargets, resolveTargetPath, TARGET_LABELS, type McpTarget } from './paths.js';
import type { ConfigFormat } from './merge-config.js';

/** Read env from an existing MCP server entry so re-running `init` preserves keys (e.g. EMBEDDING_DIMENSIONS) when flags are omitted. */
export function readExistingServerEnv(
  existing: Record<string, unknown> | null,
  format: ConfigFormat,
  serverName: string
): Record<string, string> {
  if (!existing) return {};
  const bucketKey = format === 'mcpServers' ? 'mcpServers' : 'servers';
  const bucket = existing[bucketKey];
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return {};
  const block = (bucket as Record<string, unknown>)[serverName];
  if (!block || typeof block !== 'object' || Array.isArray(block)) return {};
  const raw = (block as { env?: unknown }).env;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export type InitOptions = {
  cwd: string;
  mcp: McpTarget;
  serverName: string;
  ollamaUrl: string;
  ollamaModel: string;
  qdrantUrl: string;
  qdrantApiKey?: string;
  /** Omitted → keep prior `EMBEDDING_DIMENSIONS` in the MCP file if any; else vibe-hnindex defaults to 1024. */
  embeddingDimensions?: number;
  dryRun: boolean;
  /** If true, write to --output instead of default path */
  output?: string;
};

export function runInit(opts: InitOptions): { written: boolean; filePath: string; json: string } {
  const resolved = opts.output
    ? {
        target: opts.mcp,
        filePath: path.resolve(opts.cwd, opts.output),
        format: resolveTargetPath(opts.mcp, opts.cwd).format,
      }
    : resolveTargetPath(opts.mcp, opts.cwd);

  let existing: Record<string, unknown> | null = null;
  if (fs.existsSync(resolved.filePath)) {
    const raw = fs.readFileSync(resolved.filePath, 'utf8');
    try {
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Invalid JSON in ${resolved.filePath} — fix or remove the file and retry`);
    }
  }

  const existingEnv = readExistingServerEnv(existing, resolved.format, opts.serverName);
  const freshEnv = defaultEnv({
    ollamaUrl: opts.ollamaUrl,
    ollamaModel: opts.ollamaModel,
    qdrantUrl: opts.qdrantUrl,
    qdrantApiKey: opts.qdrantApiKey,
    embeddingDimensions: opts.embeddingDimensions,
  });
  const env = { ...existingEnv, ...freshEnv };
  const block = defaultServerBlock(env);

  const merged = mergeServerEntry(existing, resolved.format, opts.serverName, block as Record<string, unknown>);
  const json = JSON.stringify(merged, null, 2) + '\n';

  if (opts.dryRun) {
    return { written: false, filePath: resolved.filePath, json };
  }

  const dir = path.dirname(resolved.filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resolved.filePath, json, 'utf8');
  return { written: true, filePath: resolved.filePath, json };
}

export function printTargetList(): string {
  const lines = ['Supported --mcp values:\n'];
  for (const t of listTargets()) {
    lines.push(`  ${t}`);
    lines.push(`    ${TARGET_LABELS[t]}`);
  }
  return lines.join('\n');
}

export { parseTarget, listTargets, TARGET_LABELS } from './paths.js';
