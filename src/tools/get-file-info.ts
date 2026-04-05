import { getProject, getFileChunks } from '../services/sqlite.js';

export async function getFileInfoTool(args: {
  file_path: string;
  project_name: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{
        type: 'text',
        text: `Error: Project "${args.project_name}" not found.`,
      }],
    };
  }

  const chunks = getFileChunks(args.project_name, args.file_path);
  if (chunks.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No indexed data found for file "${args.file_path}" in project "${args.project_name}".`,
      }],
    };
  }

  const firstChunk = chunks[0];
  const lastChunk = chunks[chunks.length - 1];

  const header = [
    `File: ${firstChunk.filePath}`,
    `Project: ${args.project_name}`,
    `Language: ${firstChunk.language}`,
    `Absolute path: ${firstChunk.absolutePath}`,
    `Total chunks: ${chunks.length}`,
    `Lines: ${firstChunk.startLine}-${lastChunk.endLine}`,
    '',
    '## Chunks:',
  ];

  const chunkInfos = chunks.map(c =>
    `- Chunk ${c.chunkIndex}: lines ${c.startLine}-${c.endLine} (${c.endLine - c.startLine + 1} lines)`
  );

  return {
    content: [{ type: 'text', text: [...header, ...chunkInfos].join('\n') }],
  };
}
