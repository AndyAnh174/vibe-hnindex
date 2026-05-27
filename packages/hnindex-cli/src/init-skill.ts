/**
 * Initialize vibe-hnindex skill for AI agents (Claude, Antigravity, Cursor, etc.)
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SKILL_CONTENT = readFileSync(
  join(__dirname, '..', '..', '..', 'skills', 'use-vibe-hnindex', 'SKILL.md'),
  'utf8',
);

interface InitSkillResult {
  filePath: string;
  existed: boolean;
}

/**
 * Write the vibe-hnindex skill to the appropriate directory for the target editor.
 */
export function runInitSkill(target: string, cwd: string): InitSkillResult {
  const skillDirMap: Record<string, string> = {
    claude: '.claude/skills/use-vibe-hnindex',
    'claude-desktop': '.claude/skills/use-vibe-hnindex',
    antigravity: '.antigravity/skills/use-vibe-hnindex',
    cursor: '.cursor/skills/use-vibe-hnindex',
    'cursor-project': '.cursor/skills/use-vibe-hnindex',
    windsurf: '.windsurf/skills/use-vibe-hnindex',
    codex: '.codex/skills/use-vibe-hnindex',
    openclaw: '.openclaw/workspace/skills/use-vibe-hnindex',
    vscode: '.vscode/skills/use-vibe-hnindex',
  };

  const dirName = skillDirMap[target] || `.${target}/skills/use-vibe-hnindex`;
  const dirPath = resolve(cwd, dirName);
  const filePath = join(dirPath, 'SKILL.md');

  const existed = existsSync(filePath);
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(filePath, SKILL_CONTENT, 'utf8');

  return { filePath, existed };
}

export function printSkillTargets(): string {
  return `Supported --target values:
  claude          Claude Code (.claude/skills/)
  antigravity     Google Antigravity (.antigravity/skills/)
  cursor          Cursor (.cursor/skills/)
  codex           OpenAI Codex (.codex/skills/)
  windsurf        Windsurf (.windsurf/skills/)
  vscode          VS Code (.vscode/skills/)
  openclaw        OpenClaw (.openclaw/workspace/skills/)`;
}
