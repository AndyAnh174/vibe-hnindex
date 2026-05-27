/**
 * Code Session Tool (v0.11.0)
 *
 * Gathers a structured context package for AI-assisted code tasks.
 * Designed to reduce context rot by providing everything the AI needs
 * in a single response instead of 5-15 separate search calls.
 *
 * Part of vibe-hnindex Code Agent — see docs/design/code-agent-v0.11.md
 */
import { getProject, getFileChunks, getExportsByFile } from '../services/sqlite.js';
import { isGitRepo, getFileHistory } from '../services/git.js';
import { search } from './search.js';
import { smartContextTool } from './smart-context.js';
import { projectBriefingTool } from './project-briefing.js';
import { getDependentsTool } from './dependencies.js';
import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';

interface CodeSessionArgs {
  project_name: string;
  task: string;
  target_files?: string[];
}

interface SessionFile {
  path: string;
  content: string;
  language: string;
  lines: string;
  exports: string[];
  imports: string[];
}

interface SimilarPattern {
  path: string;
  snippet: string;
  relevance: string;
  note: string;
}

interface DependencyInfo {
  installed: string[];
  relevant: string | null;
}

interface TestFile {
  path: string;
}

interface SessionResult {
  session_id: string;
  task_analysis: {
    detected_type: string;
    keywords: string[];
    relevant_dirs: string[];
  };
  core_files: SessionFile[];
  similar_patterns: SimilarPattern[];
  dependencies: DependencyInfo;
  test_files: TestFile[];
  project_structure: {
    framework: string | null;
    test_framework: string | null;
    typescript: boolean;
    language_breakdown: Record<string, number>;
  };
  impact: {
    affected_files: string[];
    dependents_count: number;
  };
  session_data: {
    collected_files: number;
    total_context_bytes: number;
    cached_for: string;
  };
}

function detectTaskType(task: string): string {
  const t = task.toLowerCase();
  if (/refactor|restructure|reorganize|migrate/.test(t)) return 'refactor';
  if (/debug|fix|bug|error|crash|broken/.test(t)) return 'debug';
  if (/add|create|implement|build|new feature/.test(t)) return 'add-feature';
  if (/explain|understand|how does|what is|document/.test(t)) return 'explain';
  if (/optimize|performance|speed|slow|faster/.test(t)) return 'optimize';
  if (/test|coverage|spec/.test(t)) return 'test';
  return 'general';
}

function extractKeywords(task: string): string[] {
  const words = task.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'does', 'what', 'should', 'would', 'will'].includes(w));
  return [...new Set(words)].slice(0, 10);
}

function findRelevantDirs(files: SessionFile[], rootPath: string): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const dir = path.relative(rootPath, path.dirname(f.path)).replace(/\\/g, '/');
    if (dir && dir !== '.') dirs.add(dir);
  }
  return Array.from(dirs).slice(0, 8);
}

async function readFileContent(filePath: string, maxLines: number = 300): Promise<string | null> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join('\n') + `\n// ... (${lines.length - maxLines} more lines, file truncated)`;
  } catch {
    return null;
  }
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');
  for (const line of lines.slice(0, 30)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || trimmed.startsWith('require(')) {
      imports.push(trimmed.slice(0, 120));
    }
  }
  return imports.slice(0, 15);
}

async function readPackageJson(projectRoot: string): Promise<{
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
} | null> {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      scripts: pkg.scripts || {},
    };
  } catch {
    return null;
  }
}

function detectFramework(deps: DependencyInfo, pkg: { scripts: Record<string, string> } | null): {
  framework: string | null;
  testFramework: string | null;
  typescript: boolean;
} {
  let framework: string | null = null;
  let testFramework: string | null = null;
  let typescript = false;

  const allDeps = deps.installed.map(d => d.toLowerCase());

  // Framework detection
  if (allDeps.some(d => d.includes('next'))) framework = 'Next.js';
  else if (allDeps.some(d => d.includes('express'))) framework = 'Express.js';
  else if (allDeps.some(d => d.includes('fastify'))) framework = 'Fastify';
  else if (allDeps.some(d => d.includes('react'))) framework = 'React';
  else if (allDeps.some(d => d.includes('vue'))) framework = 'Vue';
  else if (allDeps.some(d => d.includes('angular'))) framework = 'Angular';
  else if (allDeps.some(d => d.includes('nestjs'))) framework = 'NestJS';
  else if (allDeps.some(d => d.includes('django'))) framework = 'Django';
  else if (allDeps.some(d => d.includes('flask'))) framework = 'Flask';
  else if (allDeps.some(d => d.includes('fastapi'))) framework = 'FastAPI';

  // Test framework
  if (allDeps.some(d => d.includes('vitest'))) testFramework = 'vitest';
  else if (allDeps.some(d => d.includes('jest'))) testFramework = 'jest';
  else if (allDeps.some(d => d.includes('mocha'))) testFramework = 'mocha';
  else if (allDeps.some(d => d.includes('pytest'))) testFramework = 'pytest';
  else if (allDeps.some(d => d.includes('playwright'))) testFramework = 'playwright';

  // TypeScript
  if (allDeps.some(d => d.includes('typescript'))) typescript = true;

  return { framework, testFramework, typescript };
}

function findTestFiles(files: string[], targetFiles: string[]): string[] {
  const testPatterns = /\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/;
  const testDirs = /__(tests|specs)__/;
  const results: string[] = [];

  // Check if target files have test counterparts
  for (const tf of targetFiles) {
    const base = tf.replace(/\.[^.]+$/, '');
    const dir = path.dirname(tf);
    for (const f of files) {
      if (testPatterns.test(f) || testDirs.test(f)) {
        if (f.includes(path.basename(base)) || f.startsWith(dir)) {
          results.push(f);
        }
      }
    }
  }

  // Also add general test files near affected areas
  for (const f of files) {
    if (testPatterns.test(f) || testDirs.test(f)) {
      if (!results.includes(f)) results.push(f);
      if (results.length >= 10) break;
    }
  }

  return results.slice(0, 10);
}

export async function codeSession(args: CodeSessionArgs): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const sessionId = `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const taskType = detectTaskType(args.task);
  const keywords = extractKeywords(args.task);

  // 1. Get project info
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Project "${args.project_name}" not found. Index it first with index_codebase.` }],
    };
  }

  const rootPath = project.rootPath;

  // 2. Get smart context for the task
  const smartCtx = await smartContextTool({
    project_name: args.project_name,
    task: args.task,
  });

  // 3. Search for relevant code using multiple strategies
  const searchResults: Array<{ filePath: string; content: string; language: string; startLine: number; endLine: number }> = [];

  // Keyword search with main keyword
  for (const kw of keywords.slice(0, 3)) {
    try {
      const r = await search({
        query: kw,
        project_name: args.project_name,
        mode: 'keyword',
        limit: 5,
        dedupe_by_file: true,
      });
      const text = r.content[0]?.text || '';
      // Parse results — they are in markdown format like "### 1. path/to/file.ts..."
      const matches = text.matchAll(/\d+\.\s+\*\*([^*]+)\*\*/g);
      for (const m of matches) {
        const filePath = m[1].trim();
        if (!searchResults.some(s => s.filePath === filePath)) {
          searchResults.push({ filePath, content: '', language: '', startLine: 0, endLine: 0 });
        }
      }
    } catch { /* skip failed searches */ }
  }

  // Semantic search for natural language understanding
  if (keywords.length > 1) {
    try {
      const r = await search({
        query: args.task,
        project_name: args.project_name,
        mode: 'semantic',
        limit: 5,
        dedupe_by_file: true,
      });
      const text = r.content[0]?.text || '';
      const matches = text.matchAll(/\d+\.\s+\*\*([^*]+)\*\*/g);
      for (const m of matches) {
        const filePath = m[1].trim();
        if (!searchResults.some(s => s.filePath === filePath)) {
          searchResults.push({ filePath, content: '', language: '', startLine: 0, endLine: 0 });
        }
      }
    } catch { /* skip if semantic search unavailable */ }
  }

  // 4. Add target files if specified
  if (args.target_files) {
    for (const tf of args.target_files) {
      const fullPath = path.isAbsolute(tf) ? tf : path.join(rootPath, tf);
      if (!searchResults.some(s => s.filePath === fullPath)) {
        searchResults.push({ filePath: fullPath, content: '', language: '', startLine: 0, endLine: 0 });
      }
    }
  }

  // 5. Read file contents (limit to avoid overwhelming response)
  const coreFiles: SessionFile[] = [];
  for (const sr of searchResults.slice(0, 10)) {
    const content = await readFileContent(sr.filePath);
    if (content) {
      const ext = path.extname(sr.filePath).slice(1);
      const lines = content.split('\n');
      const exportRecords = getExportsByFile(args.project_name, sr.filePath) || [];
      const imports = extractImports(content);
      coreFiles.push({
        path: sr.filePath,
        content,
        language: ext || 'text',
        lines: `1-${lines.length}`,
        exports: exportRecords.slice(0, 10).map(e => e.exportName),
        imports: imports.slice(0, 15),
      });
    }
  }

  // 6. Find similar patterns
  const similarPatterns: SimilarPattern[] = [];
  if (coreFiles.length > 0) {
    const mainExt = path.extname(coreFiles[0].path);
    for (const sr of searchResults.slice(coreFiles.length, coreFiles.length + 8)) {
      if (path.extname(sr.filePath) === mainExt && sr.filePath !== coreFiles[0]?.path) {
        const snippet = await readFileContent(sr.filePath, 10);
        if (snippet) {
          similarPatterns.push({
            path: sr.filePath,
            snippet: snippet.split('\n').slice(0, 5).join('\n'),
            relevance: 'medium',
            note: `Same extension (${mainExt}) — potential pattern to follow`,
          });
        }
      }
    }
  }

  // 7. Dependency check
  const pkg = await readPackageJson(rootPath);
  const allDeps = pkg ? [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)] : [];
  let relevantDep: string | null = null;

  // Check if task keywords match dependency names
  for (const kw of keywords) {
    const match = allDeps.find(d => d.toLowerCase().includes(kw));
    if (match) { relevantDep = `${match} đã có trong package.json`; break; }
  }

  const dependencyInfo: DependencyInfo = {
    installed: allDeps.slice(0, 30),
    relevant: relevantDep,
  };

  // 8. Framework detection
  const frameworkInfo = detectFramework(dependencyInfo, pkg);

  // 9. Find test files
  const allFiles = searchResults.map(s => s.filePath);
  const targetFiles = args.target_files || [];
  const testFiles = findTestFiles(allFiles, targetFiles);

  // 10. Impact analysis
  let affectedFiles: string[] = [];
  let dependentsCount = 0;
  if (coreFiles.length > 0) {
    const relPath = path.relative(rootPath, coreFiles[0].path).replace(/\\/g, '/');
    try {
      const deps = await getDependentsTool({ project_name: args.project_name, file_path: relPath });
      const depsText = deps.content[0]?.text || '';
      affectedFiles = depsText.split('\n').filter(l => l.trim()).slice(0, 15);
      dependentsCount = affectedFiles.length;
    } catch { /* skip */ }
  }

  // 11. Build session result
  const relevantDirs = findRelevantDirs(coreFiles, rootPath);

  const collectedFiles = coreFiles.length + similarPatterns.length;

  const result: SessionResult = {
    session_id: sessionId,
    task_analysis: {
      detected_type: taskType,
      keywords,
      relevant_dirs: relevantDirs,
    },
    core_files: coreFiles,
    similar_patterns: similarPatterns,
    dependencies: dependencyInfo,
    test_files: testFiles.map(p => ({ path: p })),
    project_structure: {
      framework: frameworkInfo.framework,
      test_framework: frameworkInfo.testFramework,
      typescript: frameworkInfo.typescript,
      language_breakdown: {},
    },
    impact: {
      affected_files: affectedFiles,
      dependents_count: dependentsCount,
    },
    session_data: {
      collected_files: collectedFiles,
      total_context_bytes: 0,
      cached_for: '5 minutes',
    },
  };

  const jsonOutput = JSON.stringify(result, null, 2);
  result.session_data.total_context_bytes = jsonOutput.length;

  return {
    content: [{
      type: 'text',
      text: jsonOutput,
    }],
  };
}
