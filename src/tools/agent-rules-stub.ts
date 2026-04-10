import fs from 'node:fs';
import path from 'node:path';
import { getProject, getProjectStats } from '../services/sqlite.js';

function readPackageScriptCommands(root: string): string[] {
  try {
    const p = path.join(root, 'package.json');
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, 'utf-8')) as { scripts?: Record<string, string> };
    const s = j.scripts ?? {};
    const out: string[] = [];
    if (s.test) out.push('npm test');
    if (s.build) out.push('npm run build');
    if (s.lint) out.push('npm run lint');
    return out;
  } catch {
    return [];
  }
}

export async function agentRulesStubTool(args: {
  project_name: string;
  format?: 'agents' | 'claude' | 'generic';
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

  const fmt = args.format ?? 'generic';
  const stats = getProjectStats(args.project_name);
  const topLang = stats.languages[0]?.language ?? 'unknown';
  const scripts = readPackageScriptCommands(project.rootPath);

  const title =
    fmt === 'claude'
      ? 'CLAUDE.md / rules stub'
      : fmt === 'agents'
        ? 'AGENTS.md stub'
        : 'Agent rules stub';

  const lines: string[] = [
    `# ${title}`,
    '',
    `**Project:** ${project.projectName}`,
    `**Root:** ${project.rootPath}`,
    `**Last indexed:** ${project.lastIndexedAt}`,
    '',
    '## Stack (from index)',
    `- Primary language (by files): **${topLang}**`,
    `- **Files:** ${stats.totalFiles} · **Chunks:** ${stats.totalChunks}`,
    '',
  ];

  if (scripts.length > 0) {
    lines.push('## Suggested commands (from package.json)');
    for (const c of scripts) {
      lines.push(`- \`${c}\``);
    }
    lines.push('');
  }

  lines.push('## When editing this codebase');
  lines.push('');
  lines.push('- Run tests/build after substantive changes when applicable.');
  lines.push('- Use `search` with a narrow `file_pattern` to scope results.');
  lines.push('- Re-run `index_codebase` after large merges or dependency changes.');
  lines.push('- Prefer `project_briefing` for full context before large refactors.');
  lines.push('');

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
