/**
 * Worker thread: receives batches of files, chunks them, computes embeddings via the selected provider.
 * Communicates with the main thread via parentPort.
 */
import crypto from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { chunkFile } from '../services/chunker.js';
import { embed } from '../services/embeddings.js';
import { fastHash } from '../services/fast-hash.js';
import { embeddingChunkText } from '../services/typescript-ast.js';
import type { FileEntry, ChunkRecord } from '../types.js';

interface WorkerInput {
  files: FileEntry[];
  projectName: string;
  batchIndex: number;
}

interface WorkerChunkResult {
  chunk: ChunkRecord;
  vector: number[];
}

interface WorkerOutput {
  type: 'result';
  batchIndex: number;
  chunkResults: WorkerChunkResult[];
  skippedFiles?: number;
  error?: string;
}

// Worker entry point
const input = workerData as WorkerInput;

async function processBatch(input: WorkerInput): Promise<WorkerOutput> {
  const { files, projectName, batchIndex } = input;
  const chunkResults: WorkerChunkResult[] = [];
  let skippedFiles = 0;

  for (const file of files) {
    try {
      const chunks = chunkFile(file.content, file.relativePath);
      const chunkContents = chunks.map(c => embeddingChunkText(c, file.relativePath));

      if (chunkContents.length === 0) continue;

      const vectors = await embed(chunkContents);

      const now = new Date().toISOString();
      const fileHash = fastHash(file.content);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
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

        chunkResults.push({
          chunk: record,
          vector: vectors[i],
        });
      }
    } catch (error) {
      skippedFiles++;
      console.error(`[worker] Error processing file ${file.relativePath}:`, error);
      // Continue with other files
    }
  }

  return { type: 'result', batchIndex, chunkResults, skippedFiles };
}

processBatch(input)
  .then((output) => {
    parentPort?.postMessage(output);
  })
  .catch((error) => {
    parentPort?.postMessage({
      type: 'result',
      batchIndex: input.batchIndex,
      chunkResults: [],
      error: String(error),
    } satisfies WorkerOutput);
  });
