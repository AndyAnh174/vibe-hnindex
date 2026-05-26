import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { ChunkRecord } from '../types.js';
import { detectLanguage } from '../services/file-scanner.js';
import { chunkFile } from '../services/chunker.js';
import { embed } from '../services/embeddings.js';
import { healthCheck as ollamaHealthCheck } from '../services/embeddings.js';
import {
  getProject,
  insertChunks,
  deleteFileChunks,
  getExistingFileHash,
  updateProjectStats,
  setProjectIndexedGitHead,
  getProjectFileCount,
  getProjectChunkCount,
  getAllProjectFiles,
  insertDependencies,
  insertExports,
  insertSymbols,
  deleteFileDependencies,
  deleteFileExports,
  deleteSymbolsForFile,
} from '../services/sqlite.js';
import { parseImports, parseExports, resolveImportPath } from '../services/dependency-parser.js';
import { extractSymbols, toSymbolRecords } from '../services/symbol-extractor.js';
import type { DependencyRecord, ExportRecord } from '../types.js';
import {
  ensureCollection,
  upsertPoints,
  deletePoints,
  healthCheck as qdrantHealthCheck,
} from '../services/qdrant.js';
import { invalidateCache } from '../services/search-cache.js';
import { isIgnored, loadHnindexIgnore } from '../services/hnindex-ignore.js';
import { getGitHead } from '../services/git.js';

export async function indexFile(args: {
  file_path: string;
  project_name: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const absolutePath = path.resolve(args.file_path);

  // Validate file
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return {
      content: [{ type: 'text', text: `Error: "${absolutePath}" is not a valid file.` }],
    };
  }

  // Validate project exists
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{
        type: 'text',
        text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
      }],
    };
  }

  // Path traversal protection: file must be inside project root
  const resolvedRoot = path.resolve(project.rootPath);
  if (!absolutePath.startsWith(resolvedRoot + path.sep) && absolutePath !== resolvedRoot) {
    return {
      content: [{
        type: 'text',
        text: `Error: File "${absolutePath}" is outside project root "${resolvedRoot}".`,
      }],
    };
  }

  const relativePath = path.relative(resolvedRoot, absolutePath).replace(/\\/g, '/');
  const ignorePatterns = loadHnindexIgnore(resolvedRoot);
  if (isIgnored(relativePath, ignorePatterns)) {
    return {
      content: [{
        type: 'text',
        text: `Error: "${relativePath}" matches a pattern in .hnindexignore — skipped.`,
      }],
    };
  }

  // Check Ollama
  const ollamaOk = await ollamaHealthCheck();
  if (!ollamaOk) {
    return {
      content: [{
        type: 'text',
        text: `Error: Ollama is not running at ${config.ollamaUrl}.\nRun: ollama serve && ollama pull ${config.embeddingModel}`,
      }],
    };
  }

  const qdrantOk = await qdrantHealthCheck();
  let qdrantAvailable = qdrantOk;
  if (qdrantOk) {
    try {
      await ensureCollection(args.project_name);
    } catch {
      qdrantAvailable = false;
    }
  }

  // Read file
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const fileHash = crypto.createHash('sha256').update(content).digest('hex');
  const language = detectLanguage(absolutePath);

  // Check if unchanged
  const existingHash = getExistingFileHash(args.project_name, relativePath);
  if (existingHash === fileHash) {
    return {
      content: [{ type: 'text', text: `File "${relativePath}" is unchanged. No re-indexing needed.` }],
    };
  }

  // Delete old chunks
  if (existingHash !== null) {
    const oldIds = deleteFileChunks(args.project_name, relativePath);
    if (qdrantAvailable && oldIds.length > 0) {
      await deletePoints(args.project_name, oldIds);
    }
  }

  // Chunk and embed
  const chunks = chunkFile(content, relativePath);
  const now = new Date().toISOString();
  const records: ChunkRecord[] = chunks.map(chunk => ({
    id: crypto.randomUUID(),
    projectName: args.project_name,
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

  try {
    const vectors = await embed(records.map(r => r.content));
    insertChunks(records);

    if (qdrantAvailable) {
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
      await upsertPoints(args.project_name, points);
    }
  } catch (error) {
    console.error('[index-file] Embedding failed, inserting chunks without vectors:', error);
    insertChunks(records);
    qdrantAvailable = false;
  }

  // --- Dependency parsing ---
  try {
    deleteFileDependencies(args.project_name, relativePath);
    deleteFileExports(args.project_name, relativePath);
    deleteSymbolsForFile(args.project_name, relativePath);

    const projectFiles = getAllProjectFiles(args.project_name);

    const imports = parseImports(content, language);
    const depRecords: DependencyRecord[] = imports.map(imp => ({
      id: crypto.randomUUID(),
      projectName: args.project_name,
      sourceFile: relativePath,
      targetFile: resolveImportPath(imp.specifier, relativePath, projectFiles) ?? imp.specifier,
      importSpecifiers: imp.specifiers,
      importType: imp.importType,
      language,
    }));
    if (depRecords.length > 0) insertDependencies(depRecords);

    const parsedExports = parseExports(content, language);
    const exportRecords: ExportRecord[] = parsedExports.map(exp => ({
      id: crypto.randomUUID(),
      projectName: args.project_name,
      filePath: relativePath,
      exportName: exp.name,
      exportType: exp.exportType,
      lineNumber: exp.lineNumber,
      language,
    }));
    if (exportRecords.length > 0) insertExports(exportRecords);

    const parsedSymbols = extractSymbols(content, language);
    const symbolRecords = toSymbolRecords(args.project_name, relativePath, language, parsedSymbols);
    if (symbolRecords.length > 0) insertSymbols(symbolRecords);
  } catch (parseError) {
    console.error(`[index-file] Dependency parsing failed for ${relativePath}:`, parseError);
  }

  // Invalidate cache for this project after file update
  invalidateCache(args.project_name);

  // Update stats
  const fileCount = getProjectFileCount(args.project_name);
  const chunkCount = getProjectChunkCount(args.project_name);
  updateProjectStats(args.project_name, fileCount, chunkCount);
  setProjectIndexedGitHead(args.project_name, await getGitHead(resolvedRoot));

  const parts = [
    `Indexed file "${relativePath}" in project "${args.project_name}"`,
    `  Language: ${language}`,
    `  Chunks: ${records.length}`,
    `  Lines: ${chunks[0]?.startLine || 0}-${chunks[chunks.length - 1]?.endLine || 0}`,
  ];

  if (!qdrantAvailable) {
    parts.push(`  ⚠ Qdrant unavailable — semantic search disabled.`);
  }

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}
