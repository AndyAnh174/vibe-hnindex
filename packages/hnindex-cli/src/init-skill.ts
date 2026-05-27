/**
 * Initialize vibe-hnindex skill for AI agents (Claude, Antigravity, Cursor, etc.)
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Inlined SKILL.md content (avoid file path issues when installed via npm)
const SKILL_CONTENT = `---
name: use-vibe-hnindex
description: Guide for using vibe-hnindex MCP tools — indexing codebases, searching with keyword/semantic/hybrid modes, streaming, fuzzy matching, and benchmarking. Use when the user asks to index a codebase, search code, benchmark search performance, or work with codebase knowledge bases.
---

# vibe-hnindex — Agent Guide

You have access to vibe-hnindex MCP tools for indexing and searching codebases. This skill tells you how to use them effectively.

## Available Tools

### Core
- \`index_codebase(path, project_name, watch?)\` — Index a directory. Always do this first.
- \`search(query, project_name, mode?, limit?, stream?, fuzzy?, ...)\` — Search indexed code.
- \`list_projects\` — See what's indexed.

### Search Modes
| Mode | When to use |
|------|-------------|
| \`keyword\` | Exact identifiers, file paths — fastest |
| \`semantic\` | Natural language concepts, "how does X work" |
| \`hybrid\` | Best results — keyword + semantic fusion (default) |
| \`auto\` | Let server decide based on query |
| \`regex\` | Pattern matching — \`/pattern/flags\` |
| \`symbol\` | Lookup symbol by name in indexed symbols |

### Performance Features (use these!)
- **\`stream: true\`** (v0.9.0) — Runs keyword + semantic in PARALLEL (Promise.all), not sequentially. ~1.5-2x faster total response time. NOT just TTFB — actual total time reduction.
- **\`fuzzy: true\`** (v0.8.1) — Levenshtein distance auto-corrects typos. "fucntion" → finds "function".
- **\`benchmark_search(project_name, runs?)\`** (v0.9.5) — Run performance tests automatically.

### Key Search Params
- \`limit\` (default 10) — Results to return
- \`dedupe_by_file\` (default true) — One result per file
- \`expand_context\` (0-5) — Adjacent chunks for context
- \`file_pattern\` — Glob filter like \`"src/auth/**"\`
- \`symbol_kind\` — Filter: \`function\`, \`class\`, \`method\`, \`interface\`, etc.
- \`language\` — Filter by language: \`typescript\`, \`python\`, \`go\`, etc.

## Workflows

### Setup & First Search
\`\`\`
1. index_codebase(path="/project/dir", project_name="my-project")
2. search(query="authentication", project_name="my-project", stream=true)
\`\`\`

### Find Code by Concept
\`\`\`
search(query="how does token validation work", project_name="my-project", mode="hybrid", stream=true)
\`\`\`

### Smart Context — Task-Aware (v0.10.0)
\`\`\`
smart_context(project_name="my-project", file_path="src/auth.ts", task="refactor to add rate limiting")
smart_context(project_name="my-project", question="how does auth flow work?")
\`\`\`

### Find All Implementations
\`\`\`
symbol_lookup(project_name="my-project", symbol="AuthService", kind="class")
get_dependents(project_name="my-project", file_path="src/auth.ts")
\`\`\`

### Check Impact Before Refactoring
\`\`\`
impact_analysis(project_name="my-project", file_path="src/auth.ts", depth=3)
\`\`\`

### Benchmark Performance
\`\`\`
benchmark_search(project_name="my-project", runs=3)
\`\`\`

## Best Practices
1. **Always index first** — search won't work without indexed data
2. **Use stream=true** — always faster for hybrid/semantic modes
3. **Narrow searches first** — use file_pattern to scope, then widen
4. **Small limit** — start with limit=5-10, increase if needed
5. **Dedupe** — keep dedupe_by_file=true for diverse results
6. **Expand context** — use expand_context=1-2 to see surrounding code
7. **Cache is automatic** — second identical search returns in ~5ms (LRU, 5min TTL)

## Prerequisites
- Ollama running (for semantic search): \`ollama serve\`
- Qdrant running (for vector storage): \`docker run -d -p 6333:6333 qdrant/qdrant\`
`;

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
