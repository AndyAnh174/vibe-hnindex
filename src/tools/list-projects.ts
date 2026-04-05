import { listProjects as dbListProjects } from '../services/sqlite.js';

export async function listProjectsTool(): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const projects = dbListProjects();

  if (projects.length === 0) {
    return {
      content: [{ type: 'text', text: 'No projects indexed yet. Use index_codebase to index a project.' }],
    };
  }

  const lines = [
    `Found ${projects.length} indexed project(s):\n`,
    '| Project | Path | Files | Chunks | Last Indexed |',
    '|---------|------|-------|--------|-------------|',
    ...projects.map(p =>
      `| ${p.projectName} | ${p.rootPath} | ${p.fileCount} | ${p.chunkCount} | ${p.lastIndexedAt} |`
    ),
  ];

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}
