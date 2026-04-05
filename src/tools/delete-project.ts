import { deleteProject as dbDeleteProject, getProject } from '../services/sqlite.js';
import { deleteCollection, healthCheck as qdrantHealthCheck } from '../services/qdrant.js';

export async function deleteProjectTool(args: {
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

  // Delete from SQLite
  dbDeleteProject(args.project_name);

  // Delete from Qdrant
  const qdrantOk = await qdrantHealthCheck();
  let qdrantDeleted = false;
  if (qdrantOk) {
    try {
      await deleteCollection(args.project_name);
      qdrantDeleted = true;
    } catch (error) {
      console.error('[delete] Qdrant deletion error:', error);
    }
  }

  const parts = [
    `Deleted project "${args.project_name}"`,
    `  Files removed: ${project.fileCount}`,
    `  Chunks removed: ${project.chunkCount}`,
    `  SQLite: ✓ cleaned`,
    `  Qdrant: ${qdrantDeleted ? '✓ cleaned' : '⚠ not cleaned (Qdrant unavailable)'}`,
  ];

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}
