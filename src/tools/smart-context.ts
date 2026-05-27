/**
 * Smart Context Generator (v0.10.0)
 *
 * Provides rich, task-aware context for AI agents:
 * - File mode: file content + imports + dependents + exports + git history
 * - Task mode: adds impact analysis, test files, similar code patterns
 * - Question mode: auto-searches relevant code, gathers full context for Q&A
 * - Refactor mode: full impact + all affected files + test files + patterns
 */
import { getProject, getFileChunks, getDependencies, getDependents, getExportsByFile, searchKeyword, getChunksByIds } from '../services/sqlite.js';
import { isGitRepo, getFileHistory } from '../services/git.js';
import { search } from './search.js';

function findTestFiles(dependents: Array<{ sourceFile: string }>, filePath: string): string[] {
  const testPatterns = /\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/;
  const testDirs = /__(tests|specs)__/;
  const seen = new Set<string>();

  // Check if the file itself has a test counterpart
  const base = filePath.replace(/\.[^.]+$/, '');
  const testCandidates = [
    `${base}.test.ts`, `${base}.spec.ts`,
    `${base}.test.tsx`, `${base}.spec.tsx`,
    `${base}.test.js`, `${base}.spec.js`,
    `__tests__/${filePath.split('/').pop()}`,
  ];
  for (const c of testCandidates) seen.add(c);

  // Check dependents for test files
  for (const d of dependents) {
    if (testPatterns.test(d.sourceFile) || testDirs.test(d.sourceFile)) {
      seen.add(d.sourceFile);
    }
  }

  return Array.from(seen).slice(0, 10);
}

function findSimilarFiles(
  filePath: string,
  allResults: Array<{ filePath: string; content: string; language: string; startLine: number; endLine: number }>,
  maxResults: number = 5,
): Array<{ filePath: string; language: string; lines: string; snippet: string }> {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const results: Array<{ filePath: string; language: string; lines: string; snippet: string }> = [];
  const seen = new Set([filePath]);

  for (const r of allResults) {
    if (seen.has(r.filePath)) continue;
    if (r.language === 'text') continue;
    // Prioritize same extension
    if (ext && r.filePath.endsWith(`.${ext}`)) {
      seen.add(r.filePath);
      results.push({
        filePath: r.filePath,
        language: r.language,
        lines: `${r.startLine}-${r.endLine}`,
        snippet: r.content.slice(0, 300),
      });
      if (results.length >= maxResults) break;
    }
  }

  // Fill remaining with any language
  if (results.length < maxResults) {
    for (const r of allResults) {
      if (seen.has(r.filePath)) continue;
      if (r.language === 'text') continue;
      seen.add(r.filePath);
      results.push({
        filePath: r.filePath,
        language: r.language,
        lines: `${r.startLine}-${r.endLine}`,
        snippet: r.content.slice(0, 300),
      });
      if (results.length >= maxResults) break;
    }
  }

  return results;
}

function inferTaskType(task?: string): 'explain' | 'refactor' | 'debug' | 'add-feature' | 'general' {
  if (!task) return 'general';
  const t = task.toLowerCase();
  if (/\brefactor\b|\brewrite\b|\brestructure\b|\bclean\s*up\b/.test(t)) return 'refactor';
  if (/\bdebug\b|\bfix\b|\bbug\b|\bissue\b|\berror\b|\bcrash\b/.test(t)) return 'debug';
  if (/\badd\b|\bcreate\b|\bimplement\b|\bfeature\b|\bbuild\b/.test(t)) return 'add-feature';
  if (/\bexplain\b|\bunderstand\b|\bhow\b|\bwhat\b|\bwhy\b|\bdocument\b/.test(t)) return 'explain';
  return 'general';
}

export async function smartContextTool(args: {
  project_name: string;
  file_path?: string;
  query?: string;
  /** Task description — triggers deeper analysis (impact, test files, similar code). v0.10.0 */
  task?: string;
  /** Natural language question — auto-searches and gathers code context for Q&A. v0.10.0 */
  question?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  if (!args.file_path && !args.query && !args.question) {
    return {
      content: [{ type: 'text', text: 'Error: At least one of file_path, query, or question must be provided.' }],
    };
  }

  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const sections: string[] = [];
  const taskType = inferTaskType(args.task);
  let hasFileContext = false;

  // ═══ File-centric context ═══
  if (args.file_path) {
    const chunks = getFileChunks(args.project_name, args.file_path);
    if (chunks.length === 0) {
      return {
        content: [{ type: 'text', text: `Error: File "${args.file_path}" not found in project "${args.project_name}".` }],
      };
    }

    hasFileContext = true;
    const language = chunks[0].language;
    const lastLine = Math.max(...chunks.map(c => c.endLine));

    const header = args.task
      ? `## 📄 File: ${args.file_path} — Task: ${args.task}`
      : `## 📄 File: ${args.file_path}`;

    sections.push(header);
    sections.push('');
    sections.push(`**Language:** ${language} | **Lines:** 1-${lastLine} | **Chunks:** ${chunks.length} | **Task type:** ${taskType}`);
    sections.push('');

    // Key content (first 3 chunks for task mode, 2 for basic)
    const previewCount = args.task ? 3 : 2;
    const previewChunks = chunks.slice(0, previewCount);
    const preview = previewChunks.map(c => c.content).join('\n');
    sections.push('### Key Content');
    sections.push('```' + language);
    sections.push(preview.slice(0, 2500));
    if (preview.length > 2500) sections.push('// ... truncated');
    sections.push('```');
    sections.push('');

    // Imports
    const deps = getDependencies(args.project_name, args.file_path);
    if (deps.length > 0) {
      sections.push(`### Imports (${deps.length})`);
      const showDeps = deps.slice(0, args.task ? 30 : 15);
      for (const d of showDeps) {
        const specs = d.importSpecifiers ? ` { ${d.importSpecifiers.join(', ')} }` : '';
        sections.push(`- ${d.targetFile}${specs}`);
      }
      if (deps.length > showDeps.length) sections.push(`- ... and ${deps.length - showDeps.length} more`);
      sections.push('');
    }

    // Dependents
    const dependents = getDependents(args.project_name, args.file_path);
    if (dependents.length > 0) {
      sections.push(`### Depended on by (${dependents.length})`);
      const showDeps = dependents.slice(0, args.task ? 20 : 10);
      for (const d of showDeps) {
        sections.push(`- ${d.sourceFile}`);
      }
      if (dependents.length > showDeps.length) sections.push(`- ... and ${dependents.length - showDeps.length} more`);
      sections.push('');
    }

    // Exports
    const exports = getExportsByFile(args.project_name, args.file_path);
    if (exports.length > 0) {
      sections.push(`### Exports (${exports.length})`);
      for (const e of exports.slice(0, 20)) {
        sections.push(`- ${e.exportName} (${e.exportType}, line ${e.lineNumber})`);
      }
      sections.push('');
    }

    // Recent git history
    const isRepo = await isGitRepo(project.rootPath);
    if (isRepo) {
      const history = await getFileHistory(project.rootPath, args.file_path, args.task ? 10 : 5);
      if (history.length > 0) {
        sections.push('### Recent Changes');
        for (const commit of history) {
          const date = commit.date.split('T')[0];
          sections.push(`- ${commit.shortHash} (${date}): ${commit.message}`);
        }
        sections.push('');
      }
    }

    // ── Task-specific additions ──
    if (args.task) {
      // Impact analysis for refactor/debug tasks
      if (taskType === 'refactor' || taskType === 'debug') {
        // Build dependency chain (BFS up to depth 3)
        const affectedFiles = new Set<string>([args.file_path]);
        const queue = [args.file_path];
        const visited = new Set<string>();
        let depth = 0;

        while (queue.length > 0 && depth < 3) {
          const levelSize = queue.length;
          for (let i = 0; i < levelSize; i++) {
            const f = queue.shift()!;
            if (visited.has(f)) continue;
            visited.add(f);
            const deps = getDependents(args.project_name, f);
            for (const d of deps) {
              if (!visited.has(d.sourceFile)) {
                affectedFiles.add(d.sourceFile);
                queue.push(d.sourceFile);
              }
            }
          }
          depth++;
        }

        if (affectedFiles.size > 1) {
          sections.push(`### 🔗 Impact Analysis (depth ${depth}, ${affectedFiles.size} files)`);
          const sorted = Array.from(affectedFiles).sort();
          for (const f of sorted) {
            const marker = f === args.file_path ? '★' : ' ';
            sections.push(`- ${marker} ${f}`);
          }
          sections.push('');
        }
      }

      // Test files
      const testFiles = findTestFiles(dependents, args.file_path);
      if (testFiles.length > 0) {
        sections.push('### 🧪 Related Test Files');
        for (const t of testFiles) {
          sections.push(`- ${t}`);
        }
        sections.push('');
      }

      // Similar code patterns
      const exportNames = exports.map(e => e.exportName).filter(Boolean);
      if (exportNames.length > 0) {
        const similarQuery = exportNames.slice(0, 3).join(' ');
        try {
          const similarResults = searchKeyword(similarQuery, args.project_name, 10);
          if (similarResults.length > 1) {
            const similar = findSimilarFiles(args.file_path, similarResults, 5);
            if (similar.length > 0) {
              sections.push('### 🔍 Similar Code Patterns');
              for (const s of similar) {
                sections.push(`**${s.filePath}** (${s.language}, lines ${s.lines})`);
                sections.push('```' + s.language);
                sections.push(s.snippet);
                sections.push('```');
                sections.push('');
              }
            }
          }
        } catch {
          // best-effort
        }
      }
    }
  }

  // ═══ Question-based context ═══
  if (args.question) {
    sections.push(hasFileContext ? '### 💡 Code Q&A Context' : '## 💡 Code Q&A Context');
    sections.push('');
    sections.push(`**Question:** ${args.question}`);
    sections.push('');

    try {
      const searchResult = await search({
        query: args.question,
        project_name: args.project_name,
        mode: 'hybrid',
        limit: 5,
        stream: true,
        dedupe_by_file: true,
      });

      const searchText = searchResult.content[0]?.text || '';
      if (!searchText.includes('Found 0 results')) {
        sections.push('**Relevant code found:**');
        sections.push('');
        sections.push(searchText);
      }
    } catch {
      // Fallback to keyword search
      const kwResults = searchKeyword(args.question, args.project_name, 5);
      if (kwResults.length > 0) {
        sections.push('**Relevant code found:**');
        sections.push('');
        for (const r of kwResults) {
          sections.push(`**${r.filePath}** (${r.language}, lines ${r.startLine}-${r.endLine})`);
          sections.push('```' + r.language);
          sections.push(r.content.slice(0, 500));
          sections.push('```');
          sections.push('');
        }
      }
    }

    // Also search for related symbols
    const keywords = args.question.split(/\s+/).filter(w => w.length >= 3).slice(0, 3);
    if (keywords.length > 0) {
      try {
        const symbolResults = searchKeyword(keywords.join(' OR '), args.project_name, 3);
        if (symbolResults.length > 0 && !hasFileContext) {
          const symbolFiles = symbolResults.slice(0, 3);
          for (const sr of symbolFiles) {
            const srDeps = getDependents(args.project_name, sr.filePath);
            if (srDeps.length > 0) {
              sections.push(`**Related to ${sr.filePath}:**`);
              for (const d of srDeps.slice(0, 5)) {
                sections.push(`- ${d.sourceFile}`);
              }
              sections.push('');
            }
          }
        }
      } catch {
        // best-effort
      }
    }
  }

  // ═══ Legacy query-based context ═══
  if (args.query && !args.question) {
    const results = searchKeyword(args.query, args.project_name, 5);
    if (results.length > 0) {
      sections.push(hasFileContext ? '### Related Search Results' : '## Search Context');
      sections.push('');
      for (const r of results) {
        sections.push(`**${r.filePath}** (${r.language}, lines ${r.startLine}-${r.endLine})`);
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
