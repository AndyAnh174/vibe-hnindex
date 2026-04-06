import fs from 'node:fs';
import path from 'node:path';
import {
  getProject,
  getBriefing,
  upsertBriefing,
  getProjectStats,
  getAllProjectFiles,
  getExportsByProject,
} from '../services/sqlite.js';
import type { ProjectInfo } from '../types.js';
import { buildDirTree, detectEntryPoints, detectFrameworks } from './codebase-overview.js';

const MAX_READ = 256 * 1024;

export function buildBriefingCacheKey(project: ProjectInfo): string {
  return `${project.fileCount}|${project.chunkCount}|${project.lastIndexedAt}`;
}

function readTextFileIfExists(absPath: string): string | null {
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile() || st.size > MAX_READ) return null;
    return fs.readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }
}

function tryReadReadme(root: string): string | null {
  for (const name of ['README.md', 'README', 'readme.md']) {
    const t = readTextFileIfExists(path.join(root, name));
    if (t) return t;
  }
  return null;
}

function tryReadClaudeMd(root: string): string | null {
  return readTextFileIfExists(path.join(root, 'CLAUDE.md'));
}

interface PkgJson {
  name?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function parsePackageJson(root: string): { summary: string; techStack: string[] } | null {
  const raw = readTextFileIfExists(path.join(root, 'package.json'));
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as PkgJson;
    const deps = Object.keys(j.dependencies ?? {});
    const devDeps = Object.keys(j.devDependencies ?? {});
    const techStack = [...new Set([...deps, ...devDeps])].slice(0, 40);
    const lines: string[] = [];
    if (j.name) lines.push(`- **name:** ${j.name}`);
    if (j.description) lines.push(`- **description:** ${j.description}`);
    if (deps.length) {
      lines.push(
        `- **dependencies (sample):** ${deps.slice(0, 8).join(', ')}${deps.length > 8 ? '…' : ''}`,
      );
    }
    if (devDeps.length) {
      lines.push(
        `- **devDependencies (sample):** ${devDeps.slice(0, 8).join(', ')}${devDeps.length > 8 ? '…' : ''}`,
      );
    }
    return { summary: lines.join('\n'), techStack };
  } catch {
    return null;
  }
}

function clampDoc(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n\n… (truncated)';
}

export function buildMarkdownBriefing(projectName: string): string {
  const project = getProject(projectName);
  if (!project) throw new Error('project not found');

  const root = project.rootPath;
  const stats = getProjectStats(projectName);
  const files = getAllProjectFiles(projectName);
  const exports = getExportsByProject(projectName, 25);

  const dirTree = buildDirTree(files);
  const entryPoints = detectEntryPoints(files);
  const frameworks = detectFrameworks(projectName, files);

  const langTable = stats.languages
    .map(l => `| ${l.language} | ${l.fileCount} | ${l.chunkCount} |`)
    .join('\n');

  const exportsByFile = new Map<string, string[]>();
  for (const exp of exports) {
    const list = exportsByFile.get(exp.filePath) || [];
    list.push(`${exp.exportName}()`);
    exportsByFile.set(exp.filePath, list);
  }
  const exportLines: string[] = [];
  let exportCount = 0;
  for (const [file, names] of exportsByFile) {
    if (exportCount >= 12) break;
    exportLines.push(
      `- **${file}**: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`,
    );
    exportCount++;
  }

  const readme = tryReadReadme(root);
  const claudeMd = tryReadClaudeMd(root);
  const pkg = parsePackageJson(root);

  const sections: string[] = [
    `# Project briefing: ${projectName}`,
    '',
    `**Path:** ${project.rootPath}`,
    `**Last indexed:** ${project.lastIndexedAt}`,
    '',
    '## From repository',
  ];

  if (readme) {
    sections.push('### README');
    sections.push(clampDoc(readme, 4000));
    sections.push('');
  } else {
    sections.push('_No README.md found._');
    sections.push('');
  }

  if (claudeMd) {
    sections.push('### CLAUDE.md');
    sections.push(clampDoc(claudeMd, 3000));
    sections.push('');
  }

  if (pkg) {
    sections.push('### package.json');
    sections.push(pkg.summary);
    sections.push('');
    sections.push('```json');
    sections.push(JSON.stringify({ tech_stack: pkg.techStack.slice(0, 30) }, null, 2));
    sections.push('```');
    sections.push('');
  }

  sections.push('## From index');
  sections.push('### Stats');
  sections.push(`- **Total files:** ${stats.totalFiles}`);
  sections.push(`- **Total chunks:** ${stats.totalChunks}`);
  sections.push(`- **Total lines:** ${stats.totalLines}`);
  sections.push('');
  sections.push('### Languages');
  sections.push('| Language | Files | Chunks |');
  sections.push('|----------|-------|--------|');
  sections.push(langTable);
  sections.push('');
  sections.push('### Directory structure');
  sections.push(clampDoc(dirTree, 6000));
  sections.push('');
  sections.push('### Entry points');
  sections.push(
    entryPoints.length > 0 ? entryPoints.map(f => `- ${f}`).join('\n') : '_None detected_',
  );
  sections.push('');
  sections.push('### Detected patterns');
  sections.push(
    frameworks.length > 0 ? frameworks.map(f => `- ${f}`).join('\n') : '_None detected_',
  );
  sections.push('');
  sections.push('### Key exports (sample)');
  sections.push(exportLines.length > 0 ? exportLines.join('\n') : '_None indexed yet_');

  return sections.join('\n');
}

export function getOrBuildBriefingMarkdown(
  projectName: string,
  regenerate: boolean,
): { markdown: string; fromCache: boolean } {
  const project = getProject(projectName);
  if (!project) {
    return { markdown: '', fromCache: false };
  }
  const cacheKey = buildBriefingCacheKey(project);
  if (!regenerate) {
    const row = getBriefing(projectName);
    if (row && row.cacheKey === cacheKey) {
      return { markdown: row.body, fromCache: true };
    }
  }
  const markdown = buildMarkdownBriefing(projectName);
  upsertBriefing(projectName, markdown, cacheKey);
  return { markdown, fromCache: false };
}

export async function projectBriefingTool(args: {
  project_name: string;
  regenerate?: boolean;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
        },
      ],
    };
  }

  const regenerate = args.regenerate ?? false;
  const { markdown, fromCache } = getOrBuildBriefingMarkdown(args.project_name, regenerate);
  if (!markdown) {
    return { content: [{ type: 'text', text: 'Error: failed to build briefing.' }] };
  }

  const header = fromCache ? '[cached]\n\n' : '[regenerated]\n\n';
  return { content: [{ type: 'text', text: header + markdown }] };
}
