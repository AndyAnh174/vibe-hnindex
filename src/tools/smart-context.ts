import { getProject, getFileChunks, getDependencies, getDependents, getExportsByFile } from '../services/sqlite.js';
import { isGitRepo, getFileHistory } from '../services/git.js';
import { searchKeyword } from '../services/sqlite.js';

export async function smartContextTool(args: {
  project_name: string;
  file_path?: string;
  query?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  if (!args.file_path && !args.query) {
    return {
      content: [{ type: 'text', text: 'Error: At least one of file_path or query must be provided.' }],
    };
  }

  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const sections: string[] = [];

  // File-centric context
  if (args.file_path) {
    const chunks = getFileChunks(args.project_name, args.file_path);
    if (chunks.length === 0) {
      return {
        content: [{ type: 'text', text: `Error: File "${args.file_path}" not found in project "${args.project_name}".` }],
      };
    }

    const language = chunks[0].language;
    const lastLine = Math.max(...chunks.map(c => c.endLine));

    sections.push(`## Smart Context: ${args.file_path}`);
    sections.push('');
    sections.push(`**Language:** ${language} | **Lines:** 1-${lastLine} | **Chunks:** ${chunks.length}`);
    sections.push('');

    // Key content (first 2 chunks)
    const previewChunks = chunks.slice(0, 2);
    const preview = previewChunks.map(c => c.content).join('\n');
    sections.push('### Key Content');
    sections.push('```' + language);
    sections.push(preview.slice(0, 2000));
    if (preview.length > 2000) sections.push('// ... truncated');
    sections.push('```');
    sections.push('');

    // Imports
    const deps = getDependencies(args.project_name, args.file_path);
    if (deps.length > 0) {
      sections.push(`### Imports (${deps.length})`);
      for (const d of deps) {
        const specs = d.importSpecifiers ? ` { ${d.importSpecifiers.join(', ')} }` : '';
        sections.push(`- ${d.targetFile}${specs}`);
      }
      sections.push('');
    }

    // Dependents
    const dependents = getDependents(args.project_name, args.file_path);
    if (dependents.length > 0) {
      sections.push(`### Depended on by (${dependents.length})`);
      for (const d of dependents) {
        sections.push(`- ${d.sourceFile}`);
      }
      sections.push('');
    }

    // Exports
    const exports = getExportsByFile(args.project_name, args.file_path);
    if (exports.length > 0) {
      sections.push(`### Exports (${exports.length})`);
      for (const e of exports) {
        sections.push(`- ${e.exportName} (${e.exportType}, line ${e.lineNumber})`);
      }
      sections.push('');
    }

    // Recent git history
    const isRepo = await isGitRepo(project.rootPath);
    if (isRepo) {
      const history = await getFileHistory(project.rootPath, args.file_path, 5);
      if (history.length > 0) {
        sections.push('### Recent Changes');
        for (const commit of history) {
          const date = commit.date.split('T')[0];
          sections.push(`- ${commit.shortHash} (${date}): ${commit.message}`);
        }
        sections.push('');
      }
    }
  }

  // Query-based context
  if (args.query) {
    const results = searchKeyword(args.query, args.project_name, 5);
    if (results.length > 0) {
      sections.push(args.file_path ? '### Related Search Results' : '## Search Context');
      sections.push('');
      for (const r of results) {
        sections.push(`**${r.filePath}** (lines ${r.startLine}-${r.endLine}, ${r.language})`);
        sections.push('```' + r.language);
        sections.push(r.content.slice(0, 500));
        sections.push('```');
        sections.push('');
      }
    }
  }

  if (sections.length === 0) {
    return {
      content: [{ type: 'text', text: 'No context found.' }],
    };
  }

  return { content: [{ type: 'text', text: sections.join('\n') }] };
}
