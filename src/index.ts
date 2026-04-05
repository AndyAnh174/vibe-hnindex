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

// Initialize database on startup
initDatabase();

const server = new McpServer({
  name: 'vibe-hnindex',
  version: '0.2.0',
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
  'Search the indexed codebase. Returns matching code chunks with file paths, line numbers, and relevance scores. Supports keyword (FTS5/BM25), semantic (vector similarity), and hybrid (RRF fusion) modes. Can filter by language and file path pattern.',
  {
    query: z.string().describe('Search query — natural language or keywords'),
    project_name: z.string().describe('Project to search in'),
    mode: z.enum(['keyword', 'semantic', 'hybrid']).default('hybrid').describe('Search mode: keyword (FTS5), semantic (vector), or hybrid (recommended)'),
    limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of results to return'),
    language: z.string().optional().describe('Filter by language (e.g., "typescript", "python", "go")'),
    file_pattern: z.string().optional().describe('Filter by file path glob pattern (e.g., "src/api/*", "*.ts", "services/**")'),
    expand_context: z.number().int().min(0).max(5).default(0).describe('Number of adjacent chunks to include before/after each result for more context (0 = no expansion)'),
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

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[vibe-hnindex] Server started (v0.2.0)');
}

main().catch((error) => {
  console.error('[vibe-hnindex] Fatal error:', error);
  process.exit(1);
});
