#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initDatabase, listProjects } from './services/sqlite.js';
import { indexCodebase } from './tools/index-codebase.js';
import { indexFile } from './tools/index-file.js';
import { search } from './tools/search.js';
import type { SearchExtra } from './tools/search.js';
import { listProjectsTool } from './tools/list-projects.js';
import { deleteProjectTool } from './tools/delete-project.js';
import { getFileInfoTool } from './tools/get-file-info.js';
import { projectStatsTool } from './tools/project-stats.js';
import { watchProjectTool, unwatchProjectTool, startWatchingProject } from './tools/watch-project.js';
import { codebaseOverviewTool } from './tools/codebase-overview.js';
import { fileSummaryTool } from './tools/file-summary.js';
import { getDependenciesTool, getDependentsTool, impactAnalysisTool } from './tools/dependencies.js';
import { recentChangesTool } from './tools/recent-changes.js';
import { smartContextTool } from './tools/smart-context.js';
import { projectBriefingTool } from './tools/project-briefing.js';
import { onboardingPromptTool } from './tools/onboarding-prompt.js';
import { symbolLookupTool } from './tools/symbol-lookup.js';
import { serverDiagnosticsTool } from './tools/server-diagnostics.js';
import { agentRulesStubTool } from './tools/agent-rules-stub.js';
import { benchmarkSearch } from './tools/benchmark-search.js';
import { codeSession } from './tools/code-session.js';
import { codeApply } from './tools/code-apply.js';
import { chatContextTool, chatContextSchema } from './tools/chat-context.js';
import { getContextResource } from './services/chat-memory.js';
import { config } from './config.js';

// Initialize database on startup
initDatabase();

const server = new McpServer({
  name: 'vibe-hnindex',
  version: '0.12.0',
}, {
  capabilities: { logging: {} },
});

// --- Resource: knowledge://projects ---
// AI clients read this on session start to know what projects exist
server.resource(
  'indexed-projects',
  'knowledge://projects',
  {
    description: 'List of all indexed codebase projects available for search',
    mimeType: 'application/json',
  },
  async () => {
    const projects = listProjects();
    if (projects.length === 0) {
      return {
        contents: [{
          uri: 'knowledge://projects',
          mimeType: 'text/plain',
          text: 'No projects indexed yet. Use the index_codebase tool to index a codebase directory.',
        }],
      };
    }

    const summary = projects.map(p =>
      `- **${p.projectName}**: ${p.rootPath} (${p.fileCount} files, ${p.chunkCount} chunks, indexed ${p.lastIndexedAt})`
    ).join('\n');

    return {
      contents: [{
        uri: 'knowledge://projects',
        mimeType: 'text/plain',
        text: `Indexed projects available for search:\n\n${summary}\n\nUse search(query, project_name) to find code in any of these projects.`,
      }],
    };
  },
);

// --- Tool: index_codebase ---
server.tool(
  'index_codebase',
  'Index an entire codebase directory for later search. Scans all supported source files, chunks them, and stores in the knowledge base with keyword and semantic indexes. Supports incremental indexing — unchanged files are skipped.',
  {
    path: z.string().describe('Absolute path to the codebase directory'),
    project_name: z.string().describe('Unique name for this project'),
    watch: z.boolean().optional().default(true).describe('After a successful index, start watching the project for file changes (same behavior as watch_project); default on'),
  },
  async (args) => indexCodebase(args),
);

// --- Tool: index_file ---
server.tool(
  'index_file',
  'Index or re-index a single file in an existing project. The project must have been indexed with index_codebase first.',
  {
    file_path: z.string().describe('Absolute path to the file'),
    project_name: z.string().describe('Project name (must already exist from index_codebase)'),
  },
  async (args) => indexFile(args),
);

// --- Tool: search ---
server.tool(
  'search',
  'Search the indexed codebase. Returns matching code chunks with file paths, line numbers, and relevance scores. Modes: keyword (FTS5), semantic (vector), hybrid (RRF fusion), auto (heuristic when SEARCH_AUTO_ROUTE), symbol (SQLite symbol index by identifier), regex (pattern matching with /pattern/flags). Results are cached (LRU, 5min TTL) for non-regex modes. Filter by symbol_kind to only see files with functions, classes, etc. Enable fuzzy:true to boost results with approximate string matching (Levenshtein) — useful for misspelled queries. Post-retrieval ordering: if RERANK_URL is set, the server POSTs {query, documents} for optional cross-encoder-style scores; if not set, results are still reordered by Qdrant semantic similarity (no extra service). Ollama (OLLAMA_URL + OLLAMA_MODEL) is only for embeddings at index/query time—not the same as RERANK_URL. Agents: you do not need to "enable" rerank manually unless the user asks to skip it (use rerank:false) or tune env; default behavior is already optimal for most tasks. Prefer a narrow file_pattern and a small limit on the first pass.',
  {
    query: z.string().describe('Search query — natural language, keywords, or a symbol name when mode is symbol'),
    project_name: z.string().describe('Project to search in'),
    mode: z
      .enum(['keyword', 'semantic', 'hybrid', 'auto', 'symbol', 'regex'])
      .default('hybrid')
      .describe('keyword | semantic | hybrid | auto (needs SEARCH_AUTO_ROUTE) | symbol (lookup by symbol name) | regex (pattern matching with /pattern/flags syntax)'),
    limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of results to return'),
    language: z.string().optional().describe('Filter by language (e.g., "typescript", "python", "go")'),
    symbol_kind: z.string().optional().describe('Filter results to only files containing symbols of this kind: function, class, method, interface, type, variable, enum, or export'),
    expand_context: z.number().int().min(0).max(5).default(0).describe('Number of adjacent chunks to include before/after each result for more context (0 = no expansion)'),
    dedupe_by_file: z.boolean().default(true).describe('If true, at most one chunk per file (best score). Set false to allow multiple chunks from the same file.'),
    content_mode: z.enum(['full', 'compact']).optional().describe('Snippet length: compact (default) or full chunk text'),
    max_content_chars: z.number().int().optional().describe('Max characters per chunk body when content_mode is compact'),
    deprioritize_generated_paths: z.boolean().optional().describe('Down-rank generated/vendor paths (default true)'),
    explain: z.boolean().optional().describe('Include score breakdown in output'),
    rerank: z
      .boolean()
      .optional()
      .describe(
        'When false, skip post-retrieval reorder (HTTP rerank if RERANK_URL is set, else semantic reorder by Qdrant scores). Default follows SEARCH_RERANK. Use false for speed or when raw hybrid/semantic order is preferred.',
      ),
    fuzzy: z
      .boolean()
      .optional()
      .describe(
        'Enable fuzzy search re-ranking — boosts results with high Levenshtein similarity to query terms. Useful for misspelled queries or approximate matching. Default follows SEARCH_FUZZY_ENABLED env var (false).',
      ),
  },
  async (args, extra) => search(args, { server, extra: extra as SearchExtra }),
);

// --- Tool: list_projects ---
server.tool(
  'list_projects',
  'List all indexed projects with their metadata including file count, chunk count, and last indexed time.',
  {},
  async () => listProjectsTool(),
);

// --- Tool: server_diagnostics ---
server.tool(
  'server_diagnostics',
  'Health check: Ollama, Qdrant, embedding probe, and config summary. Optionally pass project_name to compare SQLite chunk count with Qdrant point count.',
  {
    project_name: z.string().optional().describe('If set, compare indexed chunks vs Qdrant vectors for this project'),
  },
  async (args) => serverDiagnosticsTool(args),
);

// --- Tool: agent_rules_stub ---
server.tool(
  'agent_rules_stub',
  'Short markdown stub for CLAUDE.md / AGENTS.md: project path, index stats, optional package.json script hints (test/build/lint), rule-based bullets — not a full project_briefing.',
  {
    project_name: z.string().describe('Project name'),
    format: z.enum(['agents', 'claude', 'generic']).optional().describe('Heading style'),
  },
  async (args) => agentRulesStubTool(args),
);

// --- Tool: delete_project ---
server.tool(
  'delete_project',
  'Delete a project and all its indexed data from the knowledge base (both SQLite and Qdrant).',
  {
    project_name: z.string().describe('Name of the project to delete'),
  },
  async (args) => deleteProjectTool(args),
);

// --- Tool: get_file_info ---
server.tool(
  'get_file_info',
  'Get information about a specific indexed file including its chunks, line ranges, and language.',
  {
    file_path: z.string().describe('Relative file path within the project (e.g., "src/index.ts")'),
    project_name: z.string().describe('Project name'),
  },
  async (args) => getFileInfoTool(args),
);

// --- Tool: project_stats ---
server.tool(
  'project_stats',
  'Get detailed statistics about an indexed project: language breakdown, file/chunk counts, total lines, and averages. Useful for understanding codebase composition before searching.',
  {
    project_name: z.string().describe('Project name'),
  },
  async (args) => projectStatsTool(args),
);

// --- Tool: watch_project ---
server.tool(
  'watch_project',
  'Start watching an indexed project for file changes. When a source file is saved, it will be automatically re-indexed. Uses debouncing to avoid excessive re-indexing.',
  {
    project_name: z.string().describe('Project name (must already exist from index_codebase)'),
  },
  async (args) => watchProjectTool(args),
);

// --- Tool: unwatch_project ---
server.tool(
  'unwatch_project',
  'Stop watching a project for file changes.',
  {
    project_name: z.string().describe('Project name to stop watching'),
  },
  async (args) => unwatchProjectTool(args),
);

// --- Tool: codebase_overview ---
server.tool(
  'codebase_overview',
  'Get a high-level overview of an indexed project: directory structure, language breakdown, entry points, detected frameworks, and key exports. Useful for understanding codebase architecture without reading every file.',
  {
    project_name: z.string().describe('Project name'),
  },
  async (args) => codebaseOverviewTool(args),
);

// --- Tool: project_briefing ---
server.tool(
  'project_briefing',
  'Rule-based project briefing from README, CLAUDE.md, package.json, and indexed stats (no LLM). Results are cached in SQLite until the index fingerprint changes.',
  {
    project_name: z.string().describe('Project name'),
    regenerate: z.boolean().optional().describe('If true, rebuild briefing and refresh cache'),
  },
  async (args) => projectBriefingTool(args),
);

// --- Tool: onboarding_prompt ---
server.tool(
  'onboarding_prompt',
  'Single markdown blob for agent onboarding: cached project briefing, stats, and optional recent git activity. Output is truncated to max_chars.',
  {
    project_name: z.string().describe('Project name'),
    max_chars: z.number().int().min(1000).max(100000).optional().describe('Maximum output length in characters (default 10000)'),
    include_recent: z.boolean().optional().default(true).describe('Include a short recent-commits section (default true)'),
  },
  async (args) => onboardingPromptTool(args),
);

// --- Tool: symbol_lookup ---
server.tool(
  'symbol_lookup',
  'Find symbol definitions (classes, functions, interfaces, methods) by name in the indexed symbol table. Faster than full-text search for exact identifiers. Re-index the project if results are empty.',
  {
    project_name: z.string().describe('Project name'),
    symbol: z.string().describe('Symbol name to find (e.g., ProxyService, checkQuota)'),
    kind: z
      .enum(['class', 'function', 'interface', 'type', 'enum', 'method', 'variable', 'namespace'])
      .optional()
      .describe('Optional filter by symbol kind'),
    file_pattern: z.string().optional().describe('Optional glob to limit files (e.g., "apps/gateway/**")'),
  },
  async (args) => symbolLookupTool(args),
);

// --- Tool: file_summary ---
server.tool(
  'file_summary',
  'Get a detailed summary of a specific file: purpose, exports, imports, files that depend on it, and complexity. More efficient than reading the full file.',
  {
    project_name: z.string().describe('Project name'),
    file_path: z.string().describe('Relative file path within the project (e.g., "src/index.ts")'),
  },
  async (args) => fileSummaryTool(args),
);

// --- Tool: get_dependencies ---
server.tool(
  'get_dependencies',
  'List all imports/dependencies of a specific file. Shows what this file depends on.',
  {
    project_name: z.string().describe('Project name'),
    file_path: z.string().describe('Relative file path'),
  },
  async (args) => getDependenciesTool(args),
);

// --- Tool: get_dependents ---
server.tool(
  'get_dependents',
  'List all files that import/depend on a specific file. Shows what would be affected if this file changes.',
  {
    project_name: z.string().describe('Project name'),
    file_path: z.string().describe('Relative file path'),
  },
  async (args) => getDependentsTool(args),
);

// --- Tool: impact_analysis ---
server.tool(
  'impact_analysis',
  'Analyze the transitive impact of changing a file. Uses BFS to find all direct and indirect dependents up to a configurable depth. Essential before refactoring.',
  {
    project_name: z.string().describe('Project name'),
    file_path: z.string().describe('File to analyze impact of'),
    depth: z.number().int().min(1).max(5).default(3).describe('Max traversal depth (default 3, max 5)'),
  },
  async (args) => impactAnalysisTool(args),
);

// --- Tool: recent_changes ---
server.tool(
  'recent_changes',
  'Show recent git commits for a project with changed files cross-referenced against the index. Requires git.',
  {
    project_name: z.string().describe('Project name'),
    days: z.number().int().min(1).max(90).default(7).describe('How many days back to look (default 7)'),
    limit: z.number().int().min(1).max(100).default(20).describe('Max number of commits (default 20)'),
  },
  async (args) => recentChangesTool(args),
);

// --- Tool: smart_context ---
server.tool(
  'smart_context',
  'Get comprehensive context for a file, task, or question. v0.10.0: now supports task-aware analysis (impact, test files, similar patterns) and question-based code search. Ideal before editing, debugging, or understanding code.',
  {
    project_name: z.string().describe('Project name'),
    file_path: z.string().optional().describe('File to get context for'),
    query: z.string().optional().describe('Search query for additional context'),
    task: z.string().optional().describe('Task description (e.g. "refactor auth", "fix login bug") — triggers impact analysis, test file detection, similar code patterns. v0.10.0'),
    question: z.string().optional().describe('Natural language question (e.g. "how does auth flow work?") — auto-searches and gathers relevant code context. v0.10.0'),
  },
  async (args) => smartContextTool(args),
);

// --- Tool: code_session (v0.11.1) ---
if (config.codeAgentEnabled) {
  server.tool(
    'code_session',
    'Gather a structured context package for a coding task. Returns relevant files (with content), similar patterns, dependencies, test files, and impact analysis — everything the AI needs to reason about a code change in a single response. Use before making code changes to avoid 5-15 separate search/read calls.',
    {
      project_name: z.string().describe('Project name'),
      task: z.string().describe('Task description (e.g., "add rate limiting to the API", "refactor user service", "fix login bug")'),
      target_files: z.array(z.string()).optional().describe('Specific files to focus on (relative paths within project)'),
    },
    async (args) => codeSession(args),
  );

  // --- Tool: code_apply (v0.11.1) ---
  server.tool(
    'code_apply',
    'Apply code changes (create, modify, delete files) proposed by the AI. Respects CODE_AGENT_SCOPE for safety. Optionally runs test suite and linting after applying. Use after code_session to implement the planned changes.',
    {
      project_name: z.string().describe('Project name'),
      session_id: z.string().optional().describe('Session ID from code_session (optional)'),
      edits: z.array(z.object({
        action: z.enum(['create', 'modify', 'delete']).describe('create | modify | delete'),
        file_path: z.string().describe('Relative file path within the project'),
        content: z.string().optional().describe('Full file content for create/modify'),
        diff: z.string().optional().describe('Unified diff for modify (alternative to content)'),
      })).describe('List of edits to apply'),
      verify: z.boolean().optional().default(true).describe('Run tests, lint, and typecheck after applying (default true)'),
    },
    async (args) => codeApply(args),
  );
}

// --- Tool: chat_context (v0.12.0) ---
if (config.chatMemoryEnabled) {
  server.tool(
    'chat_context',
    'Manage chat memory: save conversation messages, load previous context, ingest entire conversation threads, or clear old context. Auto-track is always on when CHAT_MEMORY_ENABLED=true — search, smart_context, and code_session calls are logged automatically without calling this tool.',
    chatContextSchema,
    async (args) => chatContextTool(args),
  );
}

// --- Tool: benchmark_search ---
server.tool(
  'benchmark_search',
  'Run a suite of search queries and compare streaming vs non-streaming performance. Reports timing (avg/min/max), result counts, and speedup ratios. Useful for measuring vibe-hnindex performance on your project.',
  {
    project_name: z.string().describe('Project to benchmark'),
    runs: z.number().int().min(1).max(5).default(2).describe('Number of runs per query (default 2, higher = more accurate)'),
  },
  async (args) => benchmarkSearch(args),
);

// --- Resource: knowledge://context/{project} (v0.12.0) ---
if (config.chatMemoryEnabled) {
  server.resource(
    'chat-context',
    'knowledge://context/{project}',
    {
      description: 'Recent chat context and tool-auto tracked history for a project. Loaded by AI clients on session start to restore working context.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      // Extract project name from URI path: knowledge://context/my-project
      const projectName = uri.pathname.replace(/^\//, '').split('/').pop() || '';
      if (!projectName) {
        return {
          contents: [{
            uri: 'knowledge://context',
            mimeType: 'text/plain',
            text: 'Usage: knowledge://context/{project_name}',
          }],
        };
      }
      const text = getContextResource(projectName);
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/plain',
          text,
        }],
      };
    },
  );
}

// --- Auto-resume watch on startup ---
function autoResumeWatch() {
  if (!config.watchAutoResume) return;
  const projects = listProjects();
  for (const p of projects) {
    startWatchingProject(p.projectName).then((result) => {
      if (result.ok) {
        console.error(`[vibe-hnindex] Auto-resumed watch: ${p.projectName}`);
      } else {
        console.error(`[vibe-hnindex] Watch skip (${p.projectName}): ${result.message}`);
      }
    }).catch((err) => {
      console.error(`[vibe-hnindex] Watch fail (${p.projectName}):`, err);
    });
  }
}

// --- Start server ---
async function main() {
  autoResumeWatch();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[vibe-hnindex] Server started (v0.12.0)');
}

main().catch((error) => {
  console.error('[vibe-hnindex] Fatal error:', error);
  process.exit(1);
});

