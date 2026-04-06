import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { ChunkRecord } from '../types.js';
import { scanDirectory } from '../services/file-scanner.js';
import { chunkFile } from '../services/chunker.js';
import { embed } from '../services/embeddings.js';
import {
  upsertProject,
  insertChunks,
  deleteFileChunks,
  getExistingFileHash,
  updateProjectStats,
  getProjectFileCount,
  getProjectChunkCount,
  getAllProjectFiles,
  insertDependencies,
  insertExports,
  deleteFileDependencies,
  deleteFileExports,
} from '../services/sqlite.js';
import { parseImports, parseExports, resolveImportPath } from '../services/dependency-parser.js';
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

  let totalFiles = 0;
  let indexedFiles = 0;
  let skippedFiles = 0;
  let unchangedFiles = 0;
  let totalChunks = 0;

  // Batch accumulator for embedding
  let chunkBatch: ChunkRecord[] = [];
  let contentBatch: string[] = [];

  const flushBatch = async () => {
    if (chunkBatch.length === 0) return;

    try {
      // Generate embeddings
      const vectors = await embed(contentBatch);

      // Insert into SQLite
      insertChunks(chunkBatch);

      // Insert into Qdrant
      if (qdrantAvailable) {
        const points = chunkBatch.map((chunk, i) => ({
          id: chunk.id,
          vector: vectors[i],
          payload: {
            project_name: chunk.projectName,
            file_path: chunk.filePath,
            chunk_index: chunk.chunkIndex,
            start_line: chunk.startLine,
            end_line: chunk.endLine,
            language: chunk.language,
          },
        }));
        await upsertPoints(args.project_name, points);
      }

      totalChunks += chunkBatch.length;
    } catch (error) {
      console.error('[index] Error processing batch:', error);
      // Still insert into SQLite without embeddings
      try {
        insertChunks(chunkBatch);
        totalChunks += chunkBatch.length;
      } catch (sqlError) {
        console.error('[index] SQLite insert also failed:', sqlError);
        skippedFiles++;
      }
    }

    chunkBatch = [];
    contentBatch = [];
  };

  // Scan and index
  for await (const file of scanDirectory(rootPath)) {
    totalFiles++;

    // Check if file has changed (via hash)
    const fileHash = crypto.createHash('sha256').update(file.content).digest('hex');
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

    // Chunk the file
    const chunks = chunkFile(file.content, file.relativePath);
    const now = new Date().toISOString();

    for (const chunk of chunks) {
      const record: ChunkRecord = {
        id: crypto.randomUUID(),
        projectName: args.project_name,
        filePath: file.relativePath,
        absolutePath: file.absolutePath,
        chunkIndex: chunk.chunkIndex,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        language: file.language,
        fileHash,
        indexedAt: now,
      };

      chunkBatch.push(record);
      contentBatch.push(chunk.content);

      // Flush when batch is full
      if (chunkBatch.length >= config.embeddingBatchSize) {
        await flushBatch();
      }
    }

    indexedFiles++;
  }

  // Flush remaining
  await flushBatch();

  // --- Dependency parsing pass ---
  let parsedDeps = 0;
  try {
    const projectFiles = getAllProjectFiles(args.project_name);

    for await (const file of scanDirectory(rootPath)) {
      // Check if file changed (only parse changed files)
      const fileHash = crypto.createHash('sha256').update(file.content).digest('hex');
      const existingHash = getExistingFileHash(args.project_name, file.relativePath);
      if (existingHash !== fileHash) continue; // only parse files that were just indexed (hash now matches)

      try {
        // Clear old deps/exports for this file
        deleteFileDependencies(args.project_name, file.relativePath);
        deleteFileExports(args.project_name, file.relativePath);

        // Parse imports
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

        // Parse exports
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

        parsedDeps++;
      } catch (parseError) {
        console.error(`[index] Dependency parsing failed for ${file.relativePath}:`, parseError);
      }
    }
  } catch (depError) {
    console.error('[index] Dependency parsing pass failed:', depError);
  }

  // Update project stats
  const finalFileCount = getProjectFileCount(args.project_name);
  const finalChunkCount = getProjectChunkCount(args.project_name);
  updateProjectStats(args.project_name, finalFileCount, finalChunkCount);

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

  // Build summary
  const parts = [
    `Indexed project "${args.project_name}"`,
    `  Path: ${rootPath}`,
    `  Files scanned: ${totalFiles}`,
    `  Files indexed: ${indexedFiles}`,
    `  Files unchanged (skipped): ${unchangedFiles}`,
    `  Total chunks: ${finalChunkCount}`,
    `  Dependencies parsed: ${parsedDeps} files`,
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
