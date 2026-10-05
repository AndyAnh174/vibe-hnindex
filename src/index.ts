#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initDatabase, listProjects, getProject } from './services/sqlite.js';
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
import { indexCodeGraphTool, findReferencesTool, callersTool, graphContextTool } from './tools/code-graph.js';
import { evaluateRetrievalTool } from './tools/evaluate-retrieval.js';
import { workspaceContextTool, WORKSPACE_INSTRUCTIONS } from './tools/workspace-context.js';
import { locateCodeTool } from './tools/locate-code.js';

// Initialize database on startup
initDatabase();

const server = new McpServer({
  name: 'vibe-hnindex',
  version: '0.15.0',
}, {
  capabilities: { logging: {}, prompts: {} },
  instructions: WORKSPACE_INSTRUCTIONS,
});

// Read current roots on each call: a shared client may switch its workspace.
async function workspaceRoots(args: { path?: string; project_name?: string } = {}): Promise<string[]> {
  if (args.path || args.project_name || process.env.HNINDEX_PROJECT_ROOT?.trim() || !server.server.getClientCapabilities()?.roots) return [];
  try { return (await server.server.listRoots({}, { timeout: 2000 })).roots.map(root => root.uri); }
  catch { return []; }
}
const workspaceArgs = {
  project_name: z.string().min(1).max(256).optional().describe('Explicit indexed project; overrides automatic workspace selection'),
  path: z.string().min(1).max(4096).optional().describe('Explicit absolute workspace directory; otherwise use configured root or MCP client roots'),
};
server.tool('workspace_context', 'Start here: identify the active workspace, read its purpose/architecture documents, Git state and index readiness. Optionally remember a declared task per project/session. Local only; never guesses user intent or chooses among multiple roots.', {
  ...workspaceArgs,
  task: z.string().min(1).max(1000).optional().describe('Current objective explicitly declared by the user/agent'),
  session_id: z.string().min(1).max(160).optional().describe('Use a distinct ID for each concurrent agent; default is shared'),
  clear_task: z.boolean().optional(), token_budget: z.number().int().min(512).max(10000).default(2500),
}, async args => workspaceContextTool(args, await workspaceRoots(args)));
server.tool('locate_code', 'Locate indexed files, definitions and nearby CALLS/REFERENCES with file/line/symbol evidence and current-file freshness. Auto mode tries file, symbol, then local keyword search without embeddings. Explicit hybrid mode can call configured APIs. Ambiguous names return choices; refresh stale positions before editing.', {
  ...workspaceArgs,
  query: z.string().min(1).max(1000).optional(), symbol: z.string().min(1).max(256).optional().describe('Exact symbol name'),
  file_pattern: z.string().max(512).optional(), mode: z.enum(['auto', 'symbol', 'keyword', 'hybrid']).default('auto'),
  limit: z.number().int().min(1).max(20).default(8), token_budget: z.number().int().min(512).max(10000).default(2000),
}, async args => locateCodeTool(args, await workspaceRoots(args)));
server.resource('active-workspace', 'knowledge://workspace', { description: 'Active project purpose, current declared task and index state. Same selection as workspace_context.', mimeType: 'application/json' }, async () => {
  const result = await workspaceContextTool({}, await workspaceRoots());
  return { contents: [{ uri: 'knowledge://workspace', mimeType: 'application/json', text: result.content[0].text }] };
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
if (config.codeGraphEnabled) {
  server.tool('index_code_graph', 'Build an AST-based TypeScript/JavaScript code graph in SQLite, independently of embedding/vector services. Honors scanner exclusions and .hnindexignore. Re-run after changes if not using index_codebase/watch_project.', {
    path: z.string().describe('Absolute repository directory'),
    project_name: z.string().describe('Unique project name'),
  }, indexCodeGraphTool);
  const symbolArgs = {
    project_name: z.string(), symbol: z.string().min(1).describe('Exact declared symbol name'),
    file_path: z.string().optional().describe('Relative file path to disambiguate'),
    line: z.number().int().min(1).optional().describe('Definition start line to disambiguate'),
    limit: z.number().int().min(1).max(200).optional(),
  };
  server.tool('find_references', 'Find statically resolved symbol references with file/line/column evidence. Ambiguous names require file_path and optionally line.', symbolArgs, findReferencesTool);
  server.tool('callers', 'Find resolved call sites of a function/method/class. Dynamic and external calls may be missing.', symbolArgs, callersTool);
  server.tool('graph_context', 'Collect source context and evidence along bounded code graph relationships. Exact symbol/file works offline; query mode seeds from hybrid search. Token budget uses cl100k_base and may differ from the consuming model.', {
    project_name: z.string(), symbol: z.string().min(1).optional(), file_path: z.string().optional(),
    line: z.number().int().min(1).optional(), query: z.string().min(1).optional(),
    depth: z.number().int().min(0).max(3).default(1), max_nodes: z.number().int().min(1).max(100).optional(),
    token_budget: z.number().int().min(256).max(20000).default(4000),
    direction: z.enum(['incoming', 'outgoing', 'both']).default('both'),
  }, graphContextTool);
}

server.tool('evaluate_retrieval', 'Measure file-level Recall@K, MRR, nDCG, p95 latency and output tokens for labeled retrieval cases. Bypasses search cache. Semantic/hybrid cases use configured services and may incur API cost.', {
  project_name: z.string(), k: z.number().int().min(1).max(50).default(5), rerank: z.boolean().optional(),
  cases: z.array(z.object({ query: z.string().min(1), expected_files: z.array(z.string().min(1)).min(1),
    mode: z.enum(['keyword', 'semantic', 'hybrid', 'symbol', 'regex']).optional() })).min(1).max(100),
}, evaluateRetrievalTool);

server.tool(
  'search',
  'Search the indexed codebase. Returns matching code chunks with file paths, line numbers, and relevance scores. Modes: keyword (FTS5), semantic (vector), hybrid (RRF fusion), auto (heuristic when SEARCH_AUTO_ROUTE), symbol (SQLite symbol index by identifier), regex (pattern matching with /pattern/flags). Results are cached (LRU, 5min TTL) for non-regex modes. Filter by symbol_kind to only see files with functions, classes, etc. Enable fuzzy:true to boost results with approximate string matching (Levenshtein) — useful for misspelled queries. Optional reranking supports Voyage or a custom HTTP endpoint. Without a configured reranker, or when it fails, the hybrid/semantic order is preserved. Identifier/regex modes skip reranking. Prefer a narrow file_pattern and a small limit on the first pass.',
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
        'When false, skip Voyage/custom HTTP reranking. Default follows SEARCH_RERANK and RERANK_PROVIDER. Unavailable rerankers preserve retrieval order.',
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
  'Health check: configured embedding provider, Qdrant, embedding probe, and config summary. Optionally pass project_name to compare SQLite chunk count with Qdrant point count.',
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

// Compatible prompt/tool names with workspace-aware navigation guidance.
server.prompt('tool-priority', 'Workspace-aware code navigation guidance', { project_name: z.string() }, args => ({
  messages: [{ role: 'user', content: { type: 'text', text: args.project_name + ': ' + WORKSPACE_INSTRUCTIONS } }],
}));
server.tool('priority_prompt', 'Return workspace-aware code navigation guidance.', { project_name: z.string() }, async args => {
  const project = getProject(args.project_name);
  return { content: [{ type: 'text', text: project ? project.projectName + ': ' + WORKSPACE_INSTRUCTIONS : 'Project not found. Index it first.' }] };
});

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
  console.error('[vibe-hnindex] Server started (v0.15.0)');
}

main().catch((error) => {
  console.error('[vibe-hnindex] Fatal error:', error);
  process.exit(1);
});

