#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initDatabase, listProjects } from './services/sqlite.js';
import { indexCodebase } from './tools/index-codebase.js';
import { indexFile } from './tools/index-file.js';
import { search } from './tools/search.js';
import { listProjectsTool } from './tools/list-projects.js';
import { deleteProjectTool } from './tools/delete-project.js';
import { getFileInfoTool } from './tools/get-file-info.js';
import { projectStatsTool } from './tools/project-stats.js';
import { watchProjectTool, unwatchProjectTool } from './tools/watch-project.js';
import { codebaseOverviewTool } from './tools/codebase-overview.js';
import { fileSummaryTool } from './tools/file-summary.js';
import { getDependenciesTool, getDependentsTool, impactAnalysisTool } from './tools/dependencies.js';
import { recentChangesTool } from './tools/recent-changes.js';
import { smartContextTool } from './tools/smart-context.js';
import { projectBriefingTool } from './tools/project-briefing.js';
import { onboardingPromptTool } from './tools/onboarding-prompt.js';

// Initialize database on startup
initDatabase();

const server = new McpServer({
  name: 'vibe-hnindex',
  version: '0.5.0',
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
    watch: z.boolean().optional().default(false).describe('After a successful index, start watching the project for file changes (same behavior as watch_project)'),
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
  'Search the indexed codebase. Returns matching code chunks with file paths, line numbers, and relevance scores. Supports keyword (FTS5/BM25), semantic (vector similarity), and hybrid (RRF fusion) modes. Keyword mode normalizes punctuation-heavy queries into tokens. Prefer a narrow file_pattern and a small limit for the first pass; try keyword before hybrid when you know exact symbols. Can filter by language and file path pattern.',
  {
    query: z.string().describe('Search query — natural language or keywords'),
    project_name: z.string().describe('Project to search in'),
    mode: z.enum(['keyword', 'semantic', 'hybrid']).default('hybrid').describe('Search mode: keyword (FTS5), semantic (vector), or hybrid (recommended)'),
    limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of results to return'),
    language: z.string().optional().describe('Filter by language (e.g., "typescript", "python", "go")'),
    file_pattern: z.string().optional().describe('Filter by file path glob pattern (e.g., "src/api/*", "*.ts", "services/**") — use to reduce noise'),
    expand_context: z.number().int().min(0).max(5).default(0).describe('Number of adjacent chunks to include before/after each result for more context (0 = no expansion)'),
    dedupe_by_file: z.boolean().default(true).describe('If true, at most one chunk per file (best score). Set false to allow multiple chunks from the same file.'),
  },
  async (args) => search(args),
);

// --- Tool: list_projects ---
server.tool(
  'list_projects',
  'List all indexed projects with their metadata including file count, chunk count, and last indexed time.',
  {},
  async () => listProjectsTool(),
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
  'Get comprehensive context for a file or query in a single call: file content preview, imports, dependents, exports, recent git history, and optionally related search results. Ideal before editing a file.',
  {
    project_name: z.string().describe('Project name'),
    file_path: z.string().optional().describe('File to get context for'),
    query: z.string().optional().describe('Search query for additional context'),
  },
  async (args) => smartContextTool(args),
);

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[vibe-hnindex] Server started (v0.5.0)');
}

main().catch((error) => {
  console.error('[vibe-hnindex] Fatal error:', error);
  process.exit(1);
});
