import { getProject, getAllProjectFiles } from '../services/sqlite.js';
import { isGitRepo, getRecentCommits } from '../services/git.js';

export async function recentChangesTool(args: {
  project_name: string;
  days?: number;
  limit?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const isRepo = await isGitRepo(project.rootPath);
  if (!isRepo) {
    return {
      content: [{ type: 'text', text: `Error: "${project.rootPath}" is not a git repository. recent_changes requires git.` }],
    };
  }

  const days = args.days ?? 7;
  const limit = args.limit ?? 20;
  const commits = await getRecentCommits(project.rootPath, days, limit);

  if (commits.length === 0) {
    return {
      content: [{ type: 'text', text: `No commits found in the last ${days} days for project "${args.project_name}".` }],
    };
  }

  // Cross-reference with indexed files
  const indexedFiles = new Set(getAllProjectFiles(args.project_name));

  const lines: string[] = [
    `## Recent Changes: ${args.project_name} (last ${days} days)`,
    '',
  ];

  for (const commit of commits) {
    const date = commit.date.split('T')[0];
    lines.push(`### ${date} — ${commit.shortHash} — ${commit.author}`);
    lines.push(commit.message);

    if (commit.files.length > 0) {
      const indexed = commit.files.filter(f => indexedFiles.has(f));
      const notIndexed = commit.files.filter(f => !indexedFiles.has(f));

      if (indexed.length > 0) {
        lines.push(`  **Indexed:** ${indexed.join(', ')}`);
      }
      if (notIndexed.length > 0) {
        lines.push(`  _Not indexed:_ ${notIndexed.join(', ')}`);
      }
    }
    lines.push('');
  }

  lines.push(`_${commits.length} commit(s) shown_`);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
