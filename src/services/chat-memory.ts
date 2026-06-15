/**
 * Chat Memory Service (v0.12.0)
 *
 * Auto-tracks tool interactions (search, smart_context, code_session)
 * and provides manual save/load/clear/ingest for chat context persistence.
 *
 * Hybrid storage: SQLite (full text) + Qdrant (semantic vectors).
 * Entries are always saved to SQLite synchronously. Embedding + Qdrant
 * storage is fire-and-forget (best-effort, doesn't block the response).
 * On load, semantic search via Qdrant returns top-K relevant entries,
 * then full text is fetched from SQLite — token-efficient.
 */

import type { ChatContextEntry, ChatContextMetadata, SearchResult, ChatThread } from '../types.js';
import {
  upsertChatThread,
  getChatThread,
  listChatThreads,
  insertChatContext,
  getChatContext,
  getChatContextByIds,
  clearChatContext,
  deleteChatThread,
} from './sqlite.js';
import {
  upsertChatPoints,
  searchChatSemantic,
  deleteChatPoints,
} from './qdrant.js';
import { embed, embedSingle } from './embeddings.js';
import { config } from '../config.js';

// ── Identifiers ──

function newId(): string {
  return `cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveThreadId(projectName: string, sessionId?: string): string {
  if (sessionId) return sessionId;
  const threads = listChatThreads(projectName, 1);
  const latest = threads[0];
  if (latest && (Date.now() - new Date(latest.updatedAt).getTime()) < config.chatMemoryThreadTtlMs) {
    return latest.id;
  }
  return `ct_${projectName}_${Date.now().toString(36)}`;
}

// ── Embed + store to Qdrant (background, best-effort) ──

function storeVector(id: string, projectName: string, threadId: string, content: string, source: string): void {
  if (!config.chatMemoryVectorEnabled) return;

  // Fire-and-forget — don't block the response
  embed([content])
    .then((vectors) => {
      if (!vectors[0] || vectors[0].length === 0) return;
      return upsertChatPoints(projectName, [{
        id,
        vector: vectors[0],
        payload: {
          thread_id: threadId,
          source,
          created_at: new Date().toISOString(),
        },
      }]);
    })
    .catch((err) => {
      console.error('[chat-memory] Vector store error (non-fatal):', err.message ?? err);
    });
}

// ── Auto-track: log tool interactions ──

export interface AutoTrackOptions {
  projectName: string;
  threadId?: string;
  tool: string;
  query?: string;
  resultSummary: string;
  files?: string[];
  metadata?: Record<string, unknown>;
}

export function autoTrack(opts: AutoTrackOptions): void {
  if (!config.chatMemoryEnabled) return;

  try {
    const threadId = resolveThreadId(opts.projectName, opts.threadId);
    upsertChatThread(threadId, opts.projectName);

    const meta: ChatContextMetadata = {
      tool: opts.tool,
      query: opts.query,
      files: opts.files?.slice(0, 20),
      ...opts.metadata as Record<string, string> | undefined,
    };

    const id = newId();
    insertChatContext({
      id,
      threadId,
      projectName: opts.projectName,
      source: 'tool-auto',
      role: 'system',
      content: opts.resultSummary,
      metadata: meta,
    });

    // Background: embed + store in Qdrant
    storeVector(id, opts.projectName, threadId, opts.resultSummary, 'tool-auto');
  } catch (err) {
    console.error('[chat-memory] autoTrack error:', err);
  }
}

/** Build a compact summary from search results for auto-logging. */
export function summarizeSearchResults(
  query: string,
  mode: string,
  results: SearchResult[]
): string {
  if (results.length === 0) return `[${mode}] "${query}" → no results`;
  const top = results.slice(0, 5);
  const fileSummary = top.map(r =>
    `  ${r.filePath}:${r.startLine} [score: ${r.score.toFixed(3)}]`
  ).join('\n');
  return `[${mode}] "${query}" → ${results.length} results:\n${fileSummary}`;
}

/** Build a compact summary from smart_context files for auto-logging. */
export function summarizeSmartContext(
  task: string,
  files: string[]
): string {
  if (files.length === 0) return `[smart_context] task="${task}" → no files gathered`;
  const fileList = files.slice(0, 10).map(f => `  ${f}`).join('\n');
  return `[smart_context] task="${task}" → ${files.length} files:\n${fileList}`;
}

// ── Manual operations (chat tools) ──

export interface SaveEntryArgs {
  projectName: string;
  threadId?: string;
  role: string;
  content: string;
  metadata?: ChatContextMetadata;
}

export function saveEntry(args: SaveEntryArgs): { id: string; threadId: string } {
  const threadId = resolveThreadId(args.projectName, args.threadId);
  upsertChatThread(threadId, args.projectName);

  const id = newId();
  const source = args.role === 'user' ? 'user-message' : 'ai-response';
  insertChatContext({
    id,
    threadId,
    projectName: args.projectName,
    source,
    role: args.role,
    content: args.content,
    metadata: args.metadata ?? null,
  });

  // Background: embed + store in Qdrant
  storeVector(id, args.projectName, threadId, args.content, source);

  return { id, threadId };
}

export interface IngestArgs {
  projectName: string;
  threadId?: string;
  title?: string;
  messages: Array<{ role: string; content: string }>;
}

export function ingestConversation(args: IngestArgs): { threadId: string; count: number } {
  const threadId = resolveThreadId(args.projectName, args.threadId);
  upsertChatThread(threadId, args.projectName, args.title);

  let count = 0;
  const entries: Array<{ id: string; content: string; source: string }> = [];

  for (const msg of args.messages) {
    const id = newId();
    const source = msg.role === 'user' ? 'user-message' : 'ai-response';
    insertChatContext({
      id,
      threadId,
      projectName: args.projectName,
      source,
      role: msg.role,
      content: msg.content,
      metadata: null,
    });
    entries.push({ id, content: msg.content, source });
    count++;
  }

  // Background: batch embed + store in Qdrant
  if (config.chatMemoryVectorEnabled && entries.length > 0) {
    embed(entries.map(e => e.content))
      .then((vectors) => {
        const points = entries
          .map((e, i) => {
            if (!vectors[i] || vectors[i].length === 0) return null;
            return {
              id: e.id,
              vector: vectors[i],
              payload: {
                thread_id: threadId,
                source: e.source,
                created_at: new Date().toISOString(),
              },
            };
          })
          .filter(Boolean) as Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>;
        return upsertChatPoints(args.projectName, points);
      })
      .catch((err) => {
        console.error('[chat-memory] Vector batch store error (non-fatal):', err.message ?? err);
      });
  }

  return { threadId, count };
}

export interface LoadArgs {
  projectName: string;
  threadId?: string;
  limit?: number;
  maxAgeHours?: number;
  /** Semantic search query — if set, search Qdrant vectors instead of chronological SQLite order. */
  semanticQuery?: string;
}

export async function loadContext(args: LoadArgs): Promise<{
  thread: ChatThread | null;
  entries: ChatContextEntry[];
  mode: 'chronological' | 'semantic';
}> {
  const thread = args.threadId ? getChatThread(args.threadId) : null;

  // ── Semantic path: embed query → search Qdrant → load by IDs ──
  if (args.semanticQuery && config.chatMemoryVectorEnabled) {
    try {
      const queryVec = await embedSingle(args.semanticQuery);
      if (queryVec.length > 0) {
        const hits = await searchChatSemantic(args.projectName, queryVec, args.limit ?? config.chatMemoryLoadLimit, {
          threadId: args.threadId,
        });
        if (hits.length > 0) {
          const ids = hits.map(h => h.id);
          const entries = getChatContextByIds(args.projectName, ids, {
            maxAgeHours: args.maxAgeHours ?? config.chatMemoryMaxAgeHours,
          }).reverse();
          return { thread, entries, mode: 'semantic' };
        }
      }
    } catch (err) {
      console.error('[chat-memory] Semantic load error (falling back to chronological):', err);
    }
  }

  // ── Fallback / default: chronological load from SQLite ──
  const entries = getChatContext(args.projectName, {
    threadId: args.threadId,
    limit: args.limit ?? config.chatMemoryLoadLimit,
    maxAgeHours: args.maxAgeHours ?? config.chatMemoryMaxAgeHours,
  }).reverse();

  return { thread, entries, mode: 'chronological' };
}

export interface ClearArgs {
  projectName: string;
  threadId?: string;
  maxAgeHours?: number;
}

export function clearMemory(args: ClearArgs): number {
  // Get IDs before deleting so we can clean Qdrant too
  const entries = getChatContext(args.projectName, {
    threadId: args.threadId,
    limit: 10000,
    maxAgeHours: args.maxAgeHours,
  });

  const deleted = clearChatContext(args.projectName, {
    threadId: args.threadId,
    maxAgeHours: args.maxAgeHours,
  });

  // Clean Qdrant points (background)
  if (config.chatMemoryVectorEnabled && entries.length > 0) {
    deleteChatPoints(args.projectName, entries.map(e => e.id)).catch(() => {});
  }

  return deleted;
}

// ── Resource helpers ──

export function getContextResource(projectName: string): string {
  const threads = listChatThreads(projectName, 5);
  if (threads.length === 0) {
    return `No chat context for project "${projectName}". Use chat_context tool or just start searching — tool interactions will be auto-tracked.`;
  }

  const parts: string[] = [`## Chat Context for "${projectName}"\n`];

  for (const thread of threads) {
    const entries = getChatContext(projectName, {
      threadId: thread.id,
      limit: 20,
      maxAgeHours: config.chatMemoryMaxAgeHours,
    });

    const title = thread.title || `Thread ${thread.id.slice(0, 8)}`;
    parts.push(`### ${title} (${thread.messageCount} msgs, ${thread.totalChars} chars, updated ${thread.updatedAt})`);

    for (const entry of entries.reverse()) {
      const roleLabel = entry.source === 'tool-auto'
        ? `🛠 ${entry.role}`
        : entry.role === 'user' ? '👤 User' : '🤖 AI';
      const meta = entry.metadata
        ? ` [${entry.metadata.tool ? `tool: ${entry.metadata.tool}` : ''}${entry.metadata.query ? ` query: "${entry.metadata.query.slice(0, 60)}"` : ''}]`
        : '';
      const preview = entry.content.length > 200
        ? entry.content.slice(0, 200) + '...'
        : entry.content;
      parts.push(`  ${roleLabel}${meta}: ${preview}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}
