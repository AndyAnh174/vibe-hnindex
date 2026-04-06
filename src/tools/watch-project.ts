import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import type { ChunkRecord } from '../types.js';
import { chunkFile } from '../services/chunker.js';
import { detectLanguage } from '../services/file-scanner.js';
import { embed } from '../services/embeddings.js';
import {
  getProject,
  insertChunks,
  deleteFileChunks,
  getExistingFileHash,
  updateProjectStats,
  getProjectFileCount,
  getProjectChunkCount,
} from '../services/sqlite.js';
import {
  upsertPoints,
  deletePoints,
  healthCheck as qdrantHealthCheck,
} from '../services/qdrant.js';
import { healthCheck as ollamaHealthCheck } from '../services/embeddings.js';
import { isIgnored, loadHnindexIgnore } from '../services/hnindex-ignore.js';

// Track active watchers per project
const activeWatchers = new Map<string, { watcher: fs.FSWatcher; count: number }>();

// Debounce map to avoid re-indexing the same file multiple times
const pendingFiles = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 1000;

// Cleanup all watchers on process exit
function cleanupAllWatchers() {
  for (const [name, entry] of activeWatchers) {
    entry.watcher.close();
    console.error(`[watch] Stopped watching: ${name}`);
  }
  activeWatchers.clear();
  for (const timeout of pendingFiles.values()) {
    clearTimeout(timeout);
  }
  pendingFiles.clear();
}

process.on('exit', cleanupAllWatchers);
process.on('SIGINT', () => { cleanupAllWatchers(); process.exit(0); });
process.on('SIGTERM', () => { cleanupAllWatchers(); process.exit(0); });

async function reindexFile(
  projectName: string,
  rootPath: string,
  absolutePath: string,
): Promise<string | null> {
  const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, '/');

  // Read file
  let content: string;
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.size > config.maxFileSize || stat.size === 0) return null;

    const buffer = fs.readFileSync(absolutePath);
    // Binary check
    const checkLen = Math.min(buffer.length, 8192);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0) return null;
    }
    content = buffer.toString('utf-8');
  } catch {
    return null;
  }

  // Hash check
  const fileHash = crypto.createHash('sha256').update(content).digest('hex');
  const existingHash = getExistingFileHash(projectName, relativePath);
  if (existingHash === fileHash) return null; // unchanged

  // Delete old chunks
  if (existingHash !== null) {
    const oldIds = deleteFileChunks(projectName, relativePath);
    const qdrantOk = await qdrantHealthCheck();
    if (qdrantOk && oldIds.length > 0) {
      await deletePoints(projectName, oldIds);
    }
  }

  // Chunk + embed
  const language = detectLanguage(absolutePath);
  const chunks = chunkFile(content, relativePath);
  const now = new Date().toISOString();

  const records: ChunkRecord[] = chunks.map(chunk => ({
    id: crypto.randomUUID(),
    projectName,
    filePath: relativePath,
    absolutePath,
    chunkIndex: chunk.chunkIndex,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    content: chunk.content,
    language,
    fileHash,
    indexedAt: now,
  }));

  const ollamaOk = await ollamaHealthCheck();
  if (ollamaOk && records.length > 0) {
    try {
      const vectors = await embed(records.map(r => r.content));
      insertChunks(records);

      const qdrantOk = await qdrantHealthCheck();
      if (qdrantOk) {
        const points = records.map((r, i) => ({
          id: r.id,
          vector: vectors[i],
          payload: {
            project_name: r.projectName,
            file_path: r.filePath,
            chunk_index: r.chunkIndex,
            start_line: r.startLine,
            end_line: r.endLine,
            language: r.language,
          },
        }));
        await upsertPoints(projectName, points);
      }
    } catch (error) {
      console.error(`[watch] Embed error for ${relativePath}:`, error);
      insertChunks(records);
    }
  } else {
    insertChunks(records);
  }

  // Update stats
  const fileCount = getProjectFileCount(projectName);
  const chunkCount = getProjectChunkCount(projectName);
  updateProjectStats(projectName, fileCount, chunkCount);

  return relativePath;
}

// Supported extensions for watch filtering
const WATCH_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.pyi', '.java', '.go',
  '.rs', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx', '.cs', '.rb', '.php',
  '.swift', '.kt', '.kts', '.scala', '.lua', '.sh', '.bash', '.zsh', '.sql',
  '.vue', '.svelte', '.html', '.htm', '.css', '.scss', '.less', '.sass',
  '.yaml', '.yml', '.toml', '.json', '.xml', '.md', '.mdx',
  '.proto', '.graphql', '.gql', '.tf', '.zig', '.ex', '.exs', '.erl',
  '.clj', '.cljs', '.hs', '.ml', '.mli', '.fs', '.fsx', '.dart', '.sol',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '__pycache__',
  '.venv', 'venv', 'target', 'vendor', 'coverage', '.cache',
]);

function pathHasEggInfoSegment(filename: string): boolean {
  return filename.replace(/\\/g, '/').split('/').some(p => p.endsWith('.egg-info'));
}

export async function watchProjectTool(args: {
  project_name: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{
        type: 'text',
        text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
      }],
    };
  }

  // Check if already watching
  if (activeWatchers.has(args.project_name)) {
    return {
      content: [{
        type: 'text',
        text: `Already watching project "${args.project_name}" at ${project.rootPath}`,
      }],
    };
  }

  const rootPath = project.rootPath;
  const resolvedRoot = path.resolve(rootPath);
  const ignorePatterns = loadHnindexIgnore(resolvedRoot);

  const watcher = fs.watch(rootPath, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    const fullPath = path.join(rootPath, filename);
    const ext = path.extname(filename).toLowerCase();

    // Skip non-supported files
    if (!WATCH_EXTENSIONS.has(ext)) return;

    // Skip files in ignored directories
    const parts = filename.replace(/\\/g, '/').split('/');
    if (parts.some(p => SKIP_DIRS.has(p))) return;
    if (pathHasEggInfoSegment(filename)) return;

    // Debounce: wait 1s after last change before re-indexing
    const existing = pendingFiles.get(fullPath);
    if (existing) clearTimeout(existing);

    pendingFiles.set(fullPath, setTimeout(async () => {
      pendingFiles.delete(fullPath);

      const relativePath = path.relative(resolvedRoot, fullPath).replace(/\\/g, '/');

      if (!fs.existsSync(fullPath)) {
        // File deleted — remove chunks (even if path now matches .hnindexignore)
        const oldIds = deleteFileChunks(args.project_name, relativePath);
        if (oldIds.length > 0) {
          const qdrantOk = await qdrantHealthCheck();
          if (qdrantOk) await deletePoints(args.project_name, oldIds);
        }
        console.error(`[watch] Removed: ${relativePath}`);
        return;
      }

      if (isIgnored(relativePath, ignorePatterns)) return;

      const result = await reindexFile(args.project_name, resolvedRoot, fullPath);
      if (result) {
        console.error(`[watch] Re-indexed: ${result}`);
      }
    }, DEBOUNCE_MS));
  });

  activeWatchers.set(args.project_name, { watcher, count: 0 });

  return {
    content: [{
      type: 'text',
      text: [
        `Watching project "${args.project_name}" for file changes.`,
        `Path: ${rootPath}`,
        `Files will be automatically re-indexed when saved.`,
        `Use unwatch_project to stop watching.`,
      ].join('\n'),
    }],
  };
}

export async function unwatchProjectTool(args: {
  project_name: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const entry = activeWatchers.get(args.project_name);
  if (!entry) {
    return {
      content: [{
        type: 'text',
        text: `Project "${args.project_name}" is not being watched.`,
      }],
    };
  }

  entry.watcher.close();
  activeWatchers.delete(args.project_name);

  return {
    content: [{
      type: 'text',
      text: `Stopped watching project "${args.project_name}".`,
    }],
  };
}
