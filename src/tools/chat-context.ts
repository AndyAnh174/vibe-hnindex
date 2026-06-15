/**
 * Chat Context Tool (v0.12.0)
 *
 * MCP tool for managing chat memory — save, load, clear, and ingest
 * conversation context. Tool-auto entries are logged automatically;
 * this tool is for manual conversation management.
 *
 * Part of vibe-hnindex Chat Memory System — see docs/design/chat-memory-v0.12.md
 */

import { z } from 'zod';
import {
  saveEntry,
  loadContext,
  clearMemory,
  ingestConversation,
  getContextResource,
} from '../services/chat-memory.js';
import { config } from '../config.js';

const ChatContextAction = z.enum(['save', 'load', 'clear', 'ingest', 'resource']);

export const chatContextSchema = {
  action: ChatContextAction.describe(
    'save | load | clear | ingest | resource — what to do with chat context'
  ),
  project_name: z.string().describe('Project name'),
  thread_id: z.string().optional().describe(
    'Thread/session ID. Auto-created if omitted (reuses latest active thread).'
  ),
  // --- save ---
  role: z.string().optional().describe('Role: "user" or "assistant" (for save action)'),
  content: z.string().optional().describe('Message content (for save action)'),
  // --- ingest ---
  title: z.string().optional().describe('Thread title (for ingest action)'),
  messages: z
    .array(
      z.object({
        role: z.string().describe('"user" or "assistant"'),
        content: z.string().describe('Message text'),
      })
    )
    .optional()
    .describe('Array of messages to ingest (for ingest action)'),
  // --- load / clear ---
  limit: z.number().int().min(1).max(100).optional().default(20).describe('Max entries (for load action)'),
  max_age_hours: z.number().optional().describe('Max age in hours for context (for load/clear)'),
  semantic_query: z.string().optional().describe('Semantic search query for loading context — uses Qdrant vectors to find top-K relevant entries instead of chronological order'),
};

export async function chatContextTool(args: {
  action: 'save' | 'load' | 'clear' | 'ingest' | 'resource';
  project_name: string;
  thread_id?: string;
  role?: string;
  content?: string;
  title?: string;
  messages?: Array<{ role: string; content: string }>;
  limit?: number;
  max_age_hours?: number;
  semantic_query?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  if (!config.chatMemoryEnabled) {
    return {
      content: [{ type: 'text', text: 'Chat memory is disabled. Set CHAT_MEMORY_ENABLED=true to enable.' }],
    };
  }

  switch (args.action) {
    case 'save': {
      if (!args.role || !args.content) {
        return { content: [{ type: 'text', text: 'Error: role and content are required for save action.' }] };
      }
      const result = saveEntry({
        projectName: args.project_name,
        threadId: args.thread_id,
        role: args.role,
        content: args.content,
      });
      return {
        content: [{ type: 'text', text: `✅ Saved. Thread: ${result.threadId}, Entry: ${result.id}` }],
      };
    }

    case 'ingest': {
      if (!args.messages || args.messages.length === 0) {
        return { content: [{ type: 'text', text: 'Error: messages array is required for ingest action.' }] };
      }
      const result = ingestConversation({
        projectName: args.project_name,
        threadId: args.thread_id,
        title: args.title,
        messages: args.messages,
      });
      return {
        content: [{
          type: 'text',
          text: `✅ Ingested ${result.count} messages into thread ${result.threadId}`,
        }],
      };
    }

    case 'load': {
      const { thread, entries, mode } = await loadContext({
        projectName: args.project_name,
        threadId: args.thread_id,
        limit: args.limit,
        maxAgeHours: args.max_age_hours,
        semanticQuery: args.semantic_query,
      });

      if (entries.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No context found for project "${args.project_name}". Auto-tracking starts on next search/smart_context call.`,
          }],
        };
      }

      const modeLabel = mode === 'semantic' ? ' [semantic]' : '';
      const threadInfo = thread
        ? `Thread: ${thread.title || thread.id} (${thread.messageCount} msgs)${modeLabel}\n\n`
        : `Mode: ${mode}${modeLabel}\n\n`;

      const formatted = entries.map((e, i) => {
        const ts = new Date(e.createdAt).toLocaleString();
        const roleLabel = e.source === 'tool-auto' ? `🛠 ${e.role}` : e.role;
        const meta = e.metadata
          ? `\n  meta: ${JSON.stringify(e.metadata)}`
          : '';
        return `### ${i + 1}. [${ts}] ${roleLabel}${meta}\n${e.content}`;
      }).join('\n\n---\n\n');

      return {
        content: [{
          type: 'text',
          text: `${threadInfo}Found ${entries.length} entries:\n\n${formatted}`,
        }],
      };
    }

    case 'clear': {
      const deleted = clearMemory({
        projectName: args.project_name,
        threadId: args.thread_id,
        maxAgeHours: args.max_age_hours,
      });
      return {
        content: [{ type: 'text', text: `✅ Cleared ${deleted} entries.` }],
      };
    }

    case 'resource': {
      const text = getContextResource(args.project_name);
      return {
        content: [{ type: 'text', text }],
      };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
  }
}
