import { getProject, getProjectStats, getAllProjectFiles, getExportsByProject, getFileChunks } from '../services/sqlite.js';

export async function codebaseOverviewTool(args: {
  project_name: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const stats = getProjectStats(args.project_name);
  const files = getAllProjectFiles(args.project_name);
  const exports = getExportsByProject(args.project_name, 30);

  // Build directory tree
  const dirTree = buildDirTree(files);

  // Detect entry points
  const entryPoints = detectEntryPoints(files);

  // Detect frameworks
  const frameworks = detectFrameworks(args.project_name, files);

  // Language table
  const langTable = stats.languages.map(l =>
    `| ${l.language} | ${l.fileCount} | ${l.chunkCount} |`
  ).join('\n');

  // Exports grouped by file (top 20 unique files)
  const exportsByFile = new Map<string, string[]>();
  for (const exp of exports) {
    const list = exportsByFile.get(exp.filePath) || [];
    list.push(`${exp.exportName}()`);
    exportsByFile.set(exp.filePath, list);
  }

  const exportLines: string[] = [];
  let exportCount = 0;
  for (const [file, names] of exportsByFile) {
    if (exportCount >= 20) break;
    exportLines.push(`- **${file}**: ${names.join(', ')}`);
    exportCount++;
  }

  const text = [
    `## Project: ${args.project_name}`,
    `**Path:** ${project.rootPath}`,
    `**Last indexed:** ${project.lastIndexedAt}`,
    '',
    '### Structure',
    dirTree,
    '',
    '### Languages',
    '| Language | Files | Chunks |',
    '|----------|-------|--------|',
    langTable,
    '',
    `**Total:** ${stats.totalFiles} files, ${stats.totalChunks} chunks, ~${stats.totalLines} lines`,
    '',
    '### Entry Points',
    entryPoints.length > 0
      ? entryPoints.map(f => `- ${f}`).join('\n')
      : '_No common entry points detected_',
    '',
    '### Detected Patterns',
    frameworks.length > 0
      ? frameworks.map(f => `- ${f}`).join('\n')
      : '_No frameworks detected_',
    '',
    '### Key Exports',
    exportLines.length > 0
      ? exportLines.join('\n')
      : '_No exports indexed yet. Re-index to populate._',
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}

export function buildDirTree(files: string[]): string {
  const dirs = new Map<string, number>();

  for (const file of files) {
    const parts = file.replace(/\\/g, '/').split('/');
    if (parts.length === 1) {
      dirs.set('.', (dirs.get('.') || 0) + 1);
    } else {
      const topDir = parts[0];
      dirs.set(topDir, (dirs.get(topDir) || 0) + 1);
    }
  }

  const lines: string[] = [];
  // Sort by file count desc
  const sorted = [...dirs.entries()].sort((a, b) => b[1] - a[1]);
  for (const [dir, count] of sorted) {
    if (dir === '.') {
      lines.push(`  (root) — ${count} file${count > 1 ? 's' : ''}`);
    } else {
      lines.push(`  ${dir}/ — ${count} file${count > 1 ? 's' : ''}`);
    }
  }

  return lines.join('\n');
}

const ENTRY_PATTERNS = [
  /^(src\/)?index\.[jt]sx?$/,
  /^(src\/)?main\.[jt]sx?$/,
  /^(src\/)?app\.[jt]sx?$/,
  /^(src\/)?server\.[jt]sx?$/,
  /^main\.py$/,
  /^app\.py$/,
  /^manage\.py$/,
  /^main\.go$/,
  /^cmd\/.*\.go$/,
  /^src\/main\.rs$/,
  /^src\/lib\.rs$/,
];

export function detectEntryPoints(files: string[]): string[] {
  const entries: string[] = [];
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    for (const pattern of ENTRY_PATTERNS) {
      if (pattern.test(normalized)) {
        entries.push(normalized);
        break;
      }
    }
  }
  return entries;
}

function readPackageJson(projectName: string, files: string[]): Record<string, unknown> | null {
  const fileSet = new Set(files.map((f) => f.replace(/\\/g, '/')));
  if (!fileSet.has('package.json')) return null;
  const chunks = getFileChunks(projectName, 'package.json');
  if (chunks.length === 0) return null;
  const content = chunks.map((c) => c.content).join('');
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function depVersion(pkg: Record<string, unknown>, name: string): string | undefined {
  const deps = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };
  return deps?.[name];
}

export function detectFrameworks(projectName: string, files: string[]): string[] {
  const detected: string[] = [];
  const fileSet = new Set(files.map(f => f.replace(/\\/g, '/')));

  const pkg = readPackageJson(projectName, files);
  if (pkg) {
    const allDeps = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };
    if (allDeps['react']) {
      const v = depVersion(pkg, 'react');
      detected.push(v ? `React (${v})` : 'React');
    }
    if (allDeps['next']) {
      const v = depVersion(pkg, 'next');
      detected.push(v ? `Next.js (${v})` : 'Next.js');
    }
    if (allDeps['vue']) detected.push('Vue.js');
    if (allDeps['svelte']) detected.push('Svelte');
    if (allDeps['express']) detected.push('Express.js');
    if (allDeps['fastify']) detected.push('Fastify');
    if (allDeps['@nestjs/core']) detected.push('NestJS');
    if (allDeps['@angular/core']) detected.push('Angular');
    if (allDeps['@prisma/client'] || fileSet.has('prisma/schema.prisma')) {
      const v = depVersion(pkg, '@prisma/client') ?? depVersion(pkg, 'prisma');
      detected.push(v ? `Prisma (${v})` : 'Prisma');
    }
    if (allDeps['tailwindcss']) {
      const v = depVersion(pkg, 'tailwindcss');
      detected.push(v ? `Tailwind CSS (${v})` : 'Tailwind CSS');
    }
    if (allDeps['turbo']) {
      const v = depVersion(pkg, 'turbo');
      detected.push(v ? `Turborepo (${v})` : 'Turborepo');
    }
    if (allDeps['nx'] || fileSet.has('nx.json')) {
      const v = depVersion(pkg, 'nx');
      detected.push(v ? `Nx (${v})` : 'Nx');
    }
    if (fileSet.has('components.json')) {
      detected.push('shadcn/ui (components.json)');
    }
    if (allDeps['vitest']) detected.push('Vitest (testing)');
    if (allDeps['jest']) detected.push('Jest (testing)');
    if (allDeps['typescript']) detected.push('TypeScript');
    if (pkg.type === 'module') detected.push('ESM modules');
  }

  if (fileSet.has('pnpm-lock.yaml')) detected.push('Package manager: pnpm (lockfile)');
  else if (fileSet.has('yarn.lock')) detected.push('Package manager: Yarn (lockfile)');
  else if (fileSet.has('package-lock.json')) detected.push('Package manager: npm (lockfile)');

  if (fileSet.has('turbo.json') && !detected.some((d) => d.startsWith('Turborepo'))) {
    detected.push('Turborepo (turbo.json)');
  }
  if (fileSet.has('nx.json') && !detected.some((d) => d.startsWith('Nx'))) {
    detected.push('Nx (nx.json)');
  }
  if (fileSet.has('pnpm-workspace.yaml') || fileSet.has('lerna.json')) {
    detected.push('Monorepo (workspace root)');
  }

  if (fileSet.has('requirements.txt') || fileSet.has('pyproject.toml')) {
    detected.push('Python project');
  }
  if (fileSet.has('go.mod')) detected.push('Go module');
  if (fileSet.has('Cargo.toml')) detected.push('Rust/Cargo');
  if (fileSet.has('pom.xml')) detected.push('Maven (Java)');
  if (fileSet.has('build.gradle') || fileSet.has('build.gradle.kts')) detected.push('Gradle');
  if (fileSet.has('Dockerfile') || fileSet.has('docker-compose.yml')) detected.push('Docker');

  return detected;
}
