/**
 * Parallel Indexer — distributes file indexing across worker threads.
 * Falls back to single-threaded mode when worker_threads are unavailable
 * or INDEX_WORKERS=0.
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { config } from '../config.js';
import type { FileEntry, ChunkRecord } from '../types.js';
import { insertChunks } from './sqlite.js';
import { upsertPoints } from './qdrant.js';

export interface IndexProgress {
  done: number;
  total: number;
}

export interface IndexResult {
  indexedFiles: number;
  skippedFiles: number;
  totalChunks: number;
  workerCount: number;
  fallback?: boolean;
}

function getWorkerCount(): number {
  const env = process.env.INDEX_WORKERS?.trim();
  if (env === '0') return 0; // force single-threaded
  // auto-detect: os.cpus().length - 1, min 1
  const auto = Math.max(1, os.cpus().length - 1);
  if (!env || env === 'auto') return auto;
  const n = parseInt(env, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return auto;
}

function getBatchSize(): number {
  const env = process.env.INDEX_PARALLEL_BATCH?.trim();
  if (!env) return 8;
  const n = parseInt(env, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return 8;
}

/**
 * Run a single worker with a batch of files.
 */
function runWorker(
  files: FileEntry[],
  projectName: string,
  batchIndex: number
): Promise<{ chunkRecords: ChunkRecord[]; vectors: number[][] }> {
  return new Promise((resolve, reject) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const workerPath = path.resolve(
      __dirname,
      '..',
      'workers',
      'chunk-embed.worker.js'
    );

    const worker = new Worker(workerPath, {
      workerData: { files, projectName, batchIndex },
    });

    worker.on('message', (msg: { type: string; batchIndex: number; chunkResults: Array<{ chunk: ChunkRecord; vector: number[] }>; error?: string }) => {
      if (msg.type === 'result') {
        if (msg.error && msg.chunkResults.length === 0) {
          reject(new Error(msg.error));
        } else {
          const chunkRecords = msg.chunkResults.map(r => r.chunk);
          const vectors = msg.chunkResults.map(r => r.vector);
          resolve({ chunkRecords, vectors });
        }
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0 && code !== undefined) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

/**
 * Index files in parallel using worker threads.
 * Falls back to single-threaded if worker_threads unavailable or INDEX_WORKERS=0.
 */
export async function parallelIndex(
  files: FileEntry[],
  projectName: string,
  onProgress?: (done: number, total: number) => void
): Promise<IndexResult> {
  const workerCount = getWorkerCount();
  const batchSize = getBatchSize();

  // Single-threaded fallback
  if (workerCount <= 1) {
    return singleThreadIndex(files, projectName, onProgress);
  }

  // Split files into batches
  const batches: FileEntry[][] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }

  let totalChunks = 0;
  let completedFiles = 0;
  let skippedFiles = 0;

  // Process batches with worker pool (limited concurrency)
  let batchIndex = 0;

  async function processNext(): Promise<void> {
    while (batchIndex < batches.length) {
      const idx = batchIndex++;
      const batch = batches[idx];

      try {
        const { chunkRecords, vectors } = await runWorker(batch, projectName, idx);

        // Insert into SQLite
        if (chunkRecords.length > 0) {
          insertChunks(chunkRecords);
        }

        // Insert into Qdrant
        if (vectors.length > 0) {
          try {
            const points = chunkRecords.map((chunk, i) => ({
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
            await upsertPoints(projectName, points);
          } catch (error) {
            console.error('[parallel-index] Qdrant upsert failed for batch:', error);
          }
        }

        totalChunks += chunkRecords.length;
        completedFiles += batch.length;
      } catch (error) {
        console.error(`[parallel-index] Batch ${idx} failed:`, error);
        skippedFiles += batch.length;
      }

      if (onProgress) {
        onProgress(completedFiles + skippedFiles, files.length);
      }
    }
  }

  // Run workers in parallel
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(workerCount, batches.length); i++) {
    workers.push(processNext());
  }

  await Promise.all(workers);

  return {
    indexedFiles: completedFiles,
    skippedFiles,
    totalChunks,
    workerCount,
  };
}

/**
 * Single-threaded fallback indexing.
 * Chunks and embeds files sequentially.
 */
async function singleThreadIndex(
  files: FileEntry[],
  projectName: string,
  onProgress?: (done: number, total: number) => void
): Promise<IndexResult> {
  const result: IndexResult = {
    indexedFiles: 0,
    skippedFiles: 0,
    totalChunks: 0,
    workerCount: 0,
    fallback: true,
  };

  // We need to lazily import these to avoid circular deps at module level
  const { chunkFile } = await import('./chunker.js');
  const { embed } = await import('./embeddings.js');
  const crypto = await import('node:crypto');

  let totalProcessed = 0;
  let chunkBatch: ChunkRecord[] = [];
  let contentBatch: string[] = [];

  const flushBatch = async () => {
    if (chunkBatch.length === 0) return;

    try {
      const vectors = await embed(contentBatch);
      insertChunks(chunkBatch);

      try {
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
        await upsertPoints(projectName, points);
      } catch (error) {
        console.error('[parallel-index] Qdrant upsert failed in fallback:', error);
      }

      result.totalChunks += chunkBatch.length;
    } catch (error) {
      console.error('[parallel-index] Error processing batch in fallback:', error);
      try {
        insertChunks(chunkBatch);
        result.totalChunks += chunkBatch.length;
      } catch (sqlError) {
        console.error('[parallel-index] SQLite insert also failed:', sqlError);
        result.skippedFiles++;
      }
    }

    chunkBatch = [];
    contentBatch = [];
  };

  for (const file of files) {
    try {
      const chunks = chunkFile(file.content, file.relativePath);
      const now = new Date().toISOString();
      const fileHash = crypto.createHash('sha256').update(file.content).digest('hex');

      for (const chunk of chunks) {
        const record: ChunkRecord = {
          id: crypto.randomUUID(),
          projectName,
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

        if (chunkBatch.length >= config.embeddingBatchSize) {
          await flushBatch();
        }
      }

      result.indexedFiles++;
    } catch (error) {
      console.error(`[parallel-index] Error processing ${file.relativePath}:`, error);
      result.skippedFiles++;
    }

    totalProcessed++;
    if (onProgress) {
      onProgress(totalProcessed, files.length);
    }
  }

  await flushBatch();
  return result;
}
