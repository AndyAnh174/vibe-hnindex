import { getProjectWithRetry, getProjectStats } from '../services/sqlite.js';

export async function projectStatsTool(args: {
  project_name: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = await getProjectWithRetry(args.project_name);
  if (!project) {
    return {
      content: [{
        type: 'text',
        text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
      }],
    };
  }

  const stats = getProjectStats(args.project_name);

  const langTable = stats.languages.map(l =>
    `| ${l.language} | ${l.fileCount} | ${l.chunkCount} |`
  ).join('\n');

  const text = [
    `## Project: ${args.project_name}`,
    `- **Path:** ${project.rootPath}`,
    `- **Total files:** ${stats.totalFiles}`,
    `- **Total chunks:** ${stats.totalChunks}`,
    `- **Total lines indexed:** ${stats.totalLines}`,
    `- **Avg chunks per file:** ${stats.avgChunksPerFile}`,
    `- **Last indexed:** ${project.lastIndexedAt}`,
    '',
    '### Languages breakdown',
    '| Language | Files | Chunks |',
    '|----------|-------|--------|',
    langTable,
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}
