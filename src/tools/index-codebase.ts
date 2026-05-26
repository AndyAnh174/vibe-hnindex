import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { ChunkRecord, FileEntry } from '../types.js';
import { scanDirectory } from '../services/file-scanner.js';
import { chunkFile } from '../services/chunker.js';
import { embed } from '../services/embeddings.js';
import { parallelIndex } from '../services/parallel-indexer.js';
import { invalidateCache } from '../services/search-cache.js';
import { fastHash } from '../services/fast-hash.js';
import {
  upsertProject,
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
import { getGitHead } from '../services/git.js';
import { parseImports, parseExports, resolveImportPath } from '../services/dependency-parser.js';
import { extractSymbols, toSymbolRecords } from '../services/symbol-extractor.js';
import type { DependencyRecord, ExportRecord } from '../types.js';
import {
  ensureCollection,
  upsertPoints,
  deletePoints,
  healthCheck as qdrantHealthCheck,
  verifyCollectionReady,
} from '../services/qdrant.js';
import { healthCheck as ollamaHealthCheck } from '../services/embeddings.js';
import { startWatchingProject } from './watch-project.js';

export async function indexCodebase(args: {
  path: string;
  project_name: string;
  watch?: boolean;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const rootPath = path.resolve(args.path);

  // Validate path
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
    return {
      content: [{ type: 'text', text: `Error: "${rootPath}" is not a valid directory.` }],
    };
  }

  // Check services health
  const ollamaOk = await ollamaHealthCheck();
  const qdrantOk = await qdrantHealthCheck();

  if (!ollamaOk) {
    return {
      content: [{
        type: 'text',
        text: `Error: Ollama is not running at ${config.ollamaUrl}.\nRun: ollama serve && ollama pull ${config.embeddingModel}`,
      }],
    };
  }

  // Initialize project
  upsertProject(args.project_name, rootPath);

  let qdrantAvailable = qdrantOk;
  if (qdrantOk) {
    try {
      await ensureCollection(args.project_name);
    } catch (error) {
      console.error('[index] Failed to ensure Qdrant collection:', error);
      qdrantAvailable = false;
    }
  }

  const indexStartTime = Date.now();
  let totalFiles = 0;
  let indexedFiles = 0;
  let skippedFiles = 0;
  let unchangedFiles = 0;
  let totalChunks = 0;
  let parsedDeps = 0;

  // Invalidate cache for this project before re-indexing
  invalidateCache(args.project_name);

  // Pre-fetch project files for import resolution (called once, not per-file)
  const projectFiles = getAllProjectFiles(args.project_name);

  // Scan and index files — single pass: detect changes, parse deps, queue for indexing
  const filesToIndex: FileEntry[] = [];

  for await (const file of scanDirectory(rootPath)) {
    totalFiles++;

    // Fast hash for change detection (SHA-1, ~2x faster than SHA-256)
    const fileHash = fastHash(file.content);
    const existingHash = getExistingFileHash(args.project_name, file.relativePath);

    if (existingHash === fileHash) {
      unchangedFiles++;
      continue;
    }

    // File is new or changed — delete old chunks
    if (existingHash !== null) {
      const oldIds = deleteFileChunks(args.project_name, file.relativePath);
      if (qdrantAvailable && oldIds.length > 0) {
        await deletePoints(args.project_name, oldIds);
      }
    }

    // ── Parse dependencies/symbols NOW (content is in memory, no need to re-read) ──
    try {
      deleteFileDependencies(args.project_name, file.relativePath);
      deleteFileExports(args.project_name, file.relativePath);
      deleteSymbolsForFile(args.project_name, file.relativePath);

      const imports = parseImports(file.content, file.language);
      const depRecords: DependencyRecord[] = [];
      for (const imp of imports) {
        const resolved = resolveImportPath(imp.specifier, file.relativePath, projectFiles);
        depRecords.push({
          id: crypto.randomUUID(),
          projectName: args.project_name,
          sourceFile: file.relativePath,
          targetFile: resolved ?? imp.specifier,
          importSpecifiers: imp.specifiers,
          importType: imp.importType,
          language: file.language,
        });
      }
      if (depRecords.length > 0) {
        insertDependencies(depRecords);
      }

      const exports = parseExports(file.content, file.language);
      const exportRecords: ExportRecord[] = exports.map(exp => ({
        id: crypto.randomUUID(),
        projectName: args.project_name,
        filePath: file.relativePath,
        exportName: exp.name,
        exportType: exp.exportType,
        lineNumber: exp.lineNumber,
        language: file.language,
      }));
      if (exportRecords.length > 0) {
        insertExports(exportRecords);
      }

      const parsedSymbols = extractSymbols(file.content, file.language);
      const symbolRecords = toSymbolRecords(
        args.project_name,
        file.relativePath,
        file.language,
        parsedSymbols
      );
      if (symbolRecords.length > 0) {
        insertSymbols(symbolRecords);
      }

      parsedDeps++;
    } catch (parseError) {
      console.error(`[index] Dep/symbol parsing failed for ${file.relativePath}:`, parseError);
    }

    filesToIndex.push(file);
  }

  // Parallel index the collected files
  if (filesToIndex.length > 0) {
    const batchSize = config.indexParallelBatch;
    console.error(`[index] Parallel indexing ${filesToIndex.length} files with batch size ${batchSize}...`);

    const result = await parallelIndex(filesToIndex, args.project_name, (done, total) => {
      if (done % Math.max(1, Math.floor(total / 10)) === 0 || done === total) {
        console.error(`[index] Progress: ${done}/${total} files (${Math.round(done / total * 100)}%)`);
      }
    });

    indexedFiles = result.indexedFiles;
    skippedFiles = result.skippedFiles;
    totalChunks = result.totalChunks;

    if (result.fallback) {
      console.error(`[index] Using single-threaded fallback (INDEX_WORKERS=0 or only 1 CPU)`);
    } else {
      console.error(`[index] Used ${result.workerCount} workers`);
    }
  }

  // Update project stats
  const finalFileCount = getProjectFileCount(args.project_name);
  const finalChunkCount = getProjectChunkCount(args.project_name);
  updateProjectStats(args.project_name, finalFileCount, finalChunkCount);
  setProjectIndexedGitHead(args.project_name, await getGitHead(rootPath));

  let ready = true;
  let qdrantVectors: number | undefined;
  let qdrantVerifyWarn: string | undefined;
  if (qdrantAvailable) {
    const verify = await verifyCollectionReady(args.project_name);
    if (!verify.ok) {
      ready = false;
      qdrantVerifyWarn = `  ⚠ Qdrant collection verify failed: ${verify.error ?? 'unknown'}`;
    } else {
      qdrantVectors = verify.pointsCount;
    }
  }

  const indexDuration = ((Date.now() - indexStartTime) / 1000).toFixed(1);

  // Build summary
  const parts = [
    `Indexed project "${args.project_name}"`,
    `  Path: ${rootPath}`,
    `  Files scanned: ${totalFiles}`,
    `  Files indexed: ${indexedFiles}`,
    `  Files unchanged (skipped): ${unchangedFiles}`,
    `  Total chunks: ${finalChunkCount}`,
    `  Dependencies parsed: ${parsedDeps} files`,
    `  Duration: ${indexDuration}s`,
  ];

  if (qdrantVerifyWarn) {
    parts.push(qdrantVerifyWarn);
  }

  if (!qdrantAvailable) {
    parts.push(`  ⚠ Qdrant unavailable — semantic search disabled. Run: docker run -d -p 6333:6333 qdrant/qdrant`);
    ready = false;
  }

  parts.push(`  Ready: ${ready ? 'yes' : 'no'}`);
  if (qdrantVectors !== undefined) {
    parts.push(`  qdrant_vectors: ${qdrantVectors}`);
  }

  if (skippedFiles > 0) {
    parts.push(`  ⚠ ${skippedFiles} files skipped due to errors`);
  }

  if (args.watch) {
    const wr = await startWatchingProject(args.project_name);
    parts.push('');
    parts.push(wr.ok ? '  Watch:' : '  Watch (failed):');
    for (const line of wr.message.split('\n')) {
      parts.push(`  ${line}`);
    }
  }

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}
