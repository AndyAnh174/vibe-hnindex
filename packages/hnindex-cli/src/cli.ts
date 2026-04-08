#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInit, printTargetList } from './init.js';
import { parseTarget } from './paths.js';
import { runGlobalUpdate } from './update.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function readCliVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(): void {
  console.log(`hnindex — install vibe-hnindex MCP config (Windows, macOS, Linux)

Usage:
  hnindex init --mcp <target> [options]
  hnindex update
  hnindex version
  hnindex init --list

Commands:
  init       Merge vibe-hnindex into the MCP JSON for your editor (creates dirs if needed)
  update     Run: npm update -g hnindex-cli
  version    Print hnindex-cli version

Init options:
  --mcp <name>           Required. One of: claude, claude-desktop, antigravity, cursor,
                         cursor-project, windsurf, vscode
  --name <label>         Server key in JSON (default: vibe-hnindex)
  --ollama-url <url>     Default: http://localhost:11434
  --ollama-model <name> Default: bge-m3:567m
  --embedding-dimensions <n>  Vector size from Ollama for this model (default: 1024). Set e.g. 768 for nomic-embed-text-v2-moe.
  --qdrant-url <url>     Default: http://localhost:6333
  --qdrant-api-key <k>   Optional (Qdrant Cloud)
  --cwd <dir>            Working directory for project-scoped files (default: .)
  --output <path>        Write to this file instead of the default path for --mcp
  --dry-run              Print JSON to stdout; do not write files

Examples:
  hnindex init --mcp antigravity
  hnindex init --mcp claude --cwd ~/my-repo
  hnindex init --mcp vscode --qdrant-url https://xxx.cloud.qdrant.io:6333 --qdrant-api-key "***"
  hnindex init --mcp cursor-project --cwd .

Docs: https://github.com/AndyAnh174/vibe-hnindex
`);
}

function main(): void {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  if (argv[0] === 'version' || argv[0] === '--version' || argv[0] === '-v') {
    console.log(readCliVersion());
    process.exit(0);
  }

  if (argv[0] === 'update') {
    const r = runGlobalUpdate();
    console.log(r.message);
    process.exit(r.ok ? 0 : 1);
  }

  if (argv[0] !== 'init') {
    console.error(`Unknown command: ${argv[0]}\nRun: hnindex help`);
    process.exit(1);
  }

  const rest = argv.slice(1);
  if (rest[0] === '--list' || rest[0] === '-l') {
    console.log(printTargetList());
    process.exit(0);
  }

  let values: Record<string, string | boolean | undefined>;
  let positionals: string[] = [];

  try {
    const parsed = parseArgs({
      args: rest,
      options: {
        mcp: { type: 'string' },
        name: { type: 'string' },
        'ollama-url': { type: 'string' },
        'ollama-model': { type: 'string' },
        'embedding-dimensions': { type: 'string' },
        'qdrant-url': { type: 'string' },
        'qdrant-api-key': { type: 'string' },
        cwd: { type: 'string' },
        output: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
      },
      allowPositionals: true,
      strict: true,
    });
    values = parsed.values as Record<string, string | boolean | undefined>;
    positionals = parsed.positionals;
  } catch (e) {
    console.error((e as Error).message);
    console.error('Run: hnindex help');
    process.exit(1);
    return;
  }

  if (positionals.length > 0) {
    console.error(`Unexpected arguments: ${positionals.join(' ')}`);
    process.exit(1);
  }

  if (!values.mcp) {
    console.error('Missing --mcp <target>. Run: hnindex init --list');
    process.exit(1);
  }

  const mcp = parseTarget(String(values.mcp));
  const cwdOpt = optStr(values.cwd);
  const cwd = cwdOpt ? join(process.cwd(), cwdOpt) : process.cwd();

  const embDimRaw = optStr(values['embedding-dimensions'])?.trim();
  let embeddingDimensions: number | undefined;
  if (embDimRaw !== undefined) {
    const n = parseInt(embDimRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 16384) {
      console.error(
        'Invalid --embedding-dimensions: expected integer 1–16384 (e.g. 768 for nomic-embed-text-v2-moe)'
      );
      process.exit(1);
    }
    embeddingDimensions = n;
  }

  try {
    const dryRun = values['dry-run'] === true;
    const result = runInit({
      cwd,
      mcp,
      serverName: optStr(values.name)?.trim() || 'vibe-hnindex',
      ollamaUrl: optStr(values['ollama-url'])?.trim() || 'http://localhost:11434',
      ollamaModel: optStr(values['ollama-model'])?.trim() || 'bge-m3:567m',
      qdrantUrl: optStr(values['qdrant-url'])?.trim() || 'http://localhost:6333',
      qdrantApiKey: optStr(values['qdrant-api-key'])?.trim(),
      embeddingDimensions,
      dryRun,
      output: optStr(values.output)?.trim(),
    });

    if (dryRun) {
      console.log(result.json);
    } else {
      console.log(`Wrote ${result.filePath}`);
      console.log('Restart the editor or reload MCP servers for changes to apply.');
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}

main();
