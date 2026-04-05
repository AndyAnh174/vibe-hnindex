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

// Initialize database on startup
initDatabase();

const server = new McpServer({
  name: 'vibe-hnindex',
  version: '0.1.3',
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
  'Search the indexed codebase. Returns matching code chunks with file paths, line numbers, and relevance scores. Supports keyword (FTS5/BM25), semantic (vector similarity), and hybrid (RRF fusion) modes.',
  {
    query: z.string().describe('Search query — natural language or keywords'),
    project_name: z.string().describe('Project to search in'),
    mode: z.enum(['keyword', 'semantic', 'hybrid']).default('hybrid').describe('Search mode: keyword (FTS5), semantic (vector), or hybrid (recommended)'),
    limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of results to return'),
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

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[vibe-hnindex] Server started');
}

main().catch((error) => {
  console.error('[vibe-hnindex] Fatal error:', error);
  process.exit(1);
});
