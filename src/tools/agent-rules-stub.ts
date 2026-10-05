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
    "",
    "Start with workspace_context(project_name, task, session_id) to identify project purpose and declare the objective.",
    "Locate with locate_code(query or symbol), then callers/find_references and smart_context as needed.",
    "Refresh stale positions before editing. Use filesystem search for unavailable, stale or excluded code. Host/user instructions take precedence.",
    "",
    `**Project:** ${project.projectName} · **Root:** ${project.rootPath}`,
    `**Language:** ${topLang} · **Files:** ${stats.totalFiles} · **Chunks:** ${stats.totalChunks}`,
    '',
  ];

  if (scripts.length > 0) {
    lines.push('**Commands:** ' + scripts.map(c => `\`${c}\``).join(' · '));
    lines.push('');
  }

  lines.push(`Search: \`search(query, project_name="${args.project_name}", stream=true)\``);
  lines.push(`Context: \`smart_context(project_name="${args.project_name}", task="...")\``);
  lines.push(`Edit: \`code_session(project_name="${args.project_name}", task="...")\` → \`code_apply\``);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
