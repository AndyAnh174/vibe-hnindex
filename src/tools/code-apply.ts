/**
 * Code Apply Tool (v0.11.0)
 *
 * Applies code changes proposed by the AI assistant.
 * Supports create, modify, and delete actions with scope-based safety checks.
 * Optionally verifies by running tests after applying changes.
 *
 * Part of vibe-hnindex Code Agent — see docs/design/code-agent-v0.11.md
 */
import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getProject } from '../services/sqlite.js';

interface CodeEdit {
  action: 'create' | 'modify' | 'delete';
  file_path: string;
  content?: string;
  diff?: string;
}

interface CodeApplyArgs {
  session_id?: string;
  project_name: string;
  edits: CodeEdit[];
  verify?: boolean;
}

interface ChangeResult {
  file: string;
  action: string;
  result: 'ok' | 'skipped' | 'error';
  details?: string;
}

interface ApplyResult {
  status: 'applied' | 'partial' | 'blocked' | 'error';
  changes: ChangeResult[];
  verification?: {
    tests?: { passed: number; failed: number; total: number; output?: string };
    lint?: string;
    typecheck?: string;
  };
  diff_summary: string;
  recommendation: string;
}

function isPathSafe(filePath: string, scope: string, projectRoot: string): boolean {
  const resolved = path.resolve(filePath);
  const normalizedProjectRoot = path.resolve(projectRoot);

  // Must be within project root
  if (!resolved.startsWith(normalizedProjectRoot)) return false;

  const rel = path.relative(normalizedProjectRoot, resolved).replace(/\\/g, '/');

  // safe scope: no writes at all
  if (scope === 'safe') return false;

  // moderate scope: block critical paths
  if (scope === 'moderate') {
    const critical = [
      /^\.env/, /^\.git/, /^package-lock/, /^yarn\.lock/, /^pnpm-lock/,
      /^tsconfig/, /^\.eslintrc/, /^\.prettierrc/, /^next\.config/,
      /^vite\.config/, /^webpack\.config/, /^docker-compose/,
    ];
    for (const pattern of critical) {
      if (pattern.test(rel)) return false;
    }
  }

  return true;
}

function applyCreate(filePath: string, content: string): { result: 'ok' | 'error'; details?: string } {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { result: 'ok', details: `Created ${path.basename(filePath)} (${content.split('\n').length} lines)` };
  } catch (err: any) {
    return { result: 'error', details: err.message };
  }
}

function applyModify(filePath: string, content: string): { result: 'ok' | 'error'; details?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { result: 'error', details: 'File does not exist — use action: "create" for new files' };
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { result: 'ok', details: `Modified ${path.basename(filePath)}` };
  } catch (err: any) {
    return { result: 'error', details: err.message };
  }
}

function applyDelete(filePath: string): { result: 'ok' | 'error'; details?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { result: 'error', details: 'File does not exist' };
    }
    fs.unlinkSync(filePath);
    return { result: 'ok', details: `Deleted ${path.basename(filePath)}` };
  } catch (err: any) {
    return { result: 'error', details: err.message };
  }
}

function detectTestCommand(pkgPath: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};
    if (scripts.test) return 'npm test';
    if (scripts['test:run']) return 'npm run test:run';
    if (fs.existsSync(path.join(path.dirname(pkgPath), 'vitest.config.ts')) ||
        fs.existsSync(path.join(path.dirname(pkgPath), 'vitest.config.js'))) return 'npx vitest run';
    if (fs.existsSync(path.join(path.dirname(pkgPath), 'jest.config.ts')) ||
        fs.existsSync(path.join(path.dirname(pkgPath), 'jest.config.js'))) return 'npx jest';
    return null;
  } catch {
    return null;
  }
}

function detectLintCommand(pkgPath: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};
    if (scripts.lint) return 'npm run lint';
    return null;
  } catch {
    return null;
  }
}

function detectTypecheckCommand(pkgPath: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};
    if (scripts.typecheck) return 'npm run typecheck';
    if (scripts['check:types']) return 'npm run check:types';
    // TypeScript check
    if (fs.existsSync(path.join(path.dirname(pkgPath), 'tsconfig.json'))) return 'npx tsc --noEmit';
    return null;
  } catch {
    return null;
  }
}

export async function codeApply(args: CodeApplyArgs): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  if (!config.codeAgentEnabled) {
    return {
      content: [{ type: 'text', text: 'Code Agent is disabled. Set CODE_AGENT_ENABLED=true to enable.' }],
    };
  }

  // Get project root
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Project "${args.project_name}" not found.` }],
    };
  }

  const scope = config.codeAgentScope;
  const changes: ChangeResult[] = [];
  let totalAdded = 0;
  let totalFiles = 0;

  for (const edit of args.edits) {
    const resolvedPath = path.isAbsolute(edit.file_path)
      ? edit.file_path
      : path.join(project.rootPath, edit.file_path);

    // Safety check
    if (!isPathSafe(resolvedPath, scope, project.rootPath)) {
      changes.push({
        file: edit.file_path,
        action: edit.action,
        result: 'skipped',
        details: `Blocked by scope "${scope}". File is restricted or outside project root.`,
      });
      continue;
    }

    // Apply based on action
    let result: { result: 'ok' | 'error'; details?: string };

    switch (edit.action) {
      case 'create':
        if (!edit.content && !edit.diff) {
          result = { result: 'error', details: 'Missing content for create action' };
        } else {
          result = applyCreate(resolvedPath, edit.content || applySimpleDiff(resolvedPath, edit.diff || ''));
          if (result.result === 'ok') { totalAdded += (edit.content || '').split('\n').length; totalFiles++; }
        }
        break;
      case 'modify':
        if (!edit.content && !edit.diff) {
          result = { result: 'error', details: 'Missing content or diff for modify action' };
        } else if (edit.diff) {
          // Apply unified diff
          try {
            const currentContent = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, 'utf-8') : '';
            const newContent = applyUnifiedDiff(currentContent, edit.diff);
            result = applyModify(resolvedPath, newContent);
            if (result.result === 'ok') { totalFiles++; }
          } catch (err: any) {
            result = { result: 'error', details: `Diff apply failed: ${err.message}` };
          }
        } else {
          result = applyModify(resolvedPath, edit.content!);
          if (result.result === 'ok') { totalFiles++; }
        }
        break;
      case 'delete':
        result = applyDelete(resolvedPath);
        if (result.result === 'ok') totalFiles++;
        break;
      default:
        result = { result: 'error', details: `Unknown action: ${(edit as any).action}` };
    }

    changes.push({
      file: edit.file_path,
      action: edit.action,
      result: result.result,
      details: result.details,
    });
  }

  // Determine overall status
  const hasErrors = changes.some(c => c.result === 'error');
  const hasSkipped = changes.some(c => c.result === 'skipped');
  const hasOk = changes.some(c => c.result === 'ok');

  let status: ApplyResult['status'];
  if (!hasOk && hasErrors) status = 'error';
  else if (!hasOk && hasSkipped) status = 'blocked';
  else if (hasErrors || hasSkipped) status = 'partial';
  else status = 'applied';

  const result: ApplyResult = {
    status,
    changes,
    diff_summary: hasOk ? `+${totalAdded} lines across ${totalFiles} file(s)` : 'No changes applied',
    recommendation: status === 'applied' ? 'All changes applied. Review and commit.' :
                    status === 'partial' ? 'Some changes applied. Check skipped/error items.' :
                    status === 'blocked' ? 'All changes blocked by scope. Try a less restrictive scope.' :
                    'Errors occurred. Check details.',
  };

  // Verification
  if (args.verify !== false && hasOk) {
    const pkgPath = path.join(project.rootPath, 'package.json');

    // Run tests
    const testCmd = detectTestCommand(pkgPath);
    if (testCmd) {
      try {
        const output = execSync(testCmd, {
          cwd: project.rootPath,
          timeout: 120000,
          encoding: 'utf-8',
        });
        // Parse test results
        const passedMatch = output.match(/(\d+)\s+passed/);
        const failedMatch = output.match(/(\d+)\s+failed/);
        const totalMatch = output.match(/Tests:\s*(\d+)\s+passed/);

        result.verification = {
          ...(result.verification || {}),
          tests: {
            passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
            failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
            total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
            output: output.slice(-500),
          },
        };
      } catch (err: any) {
        result.verification = {
          ...(result.verification || {}),
          tests: {
            passed: 0,
            failed: 1,
            total: 1,
            output: err.stdout || err.message || 'Test execution failed',
          },
        };
      }
    }

    // Run lint
    const lintCmd = detectLintCommand(pkgPath);
    if (lintCmd) {
      try {
        const output = execSync(lintCmd, { cwd: project.rootPath, timeout: 60000, encoding: 'utf-8' });
        result.verification = {
          ...(result.verification || {}),
          lint: output.includes('error') || output.includes('✖') ? 'issues found' : 'clean',
        };
      } catch {
        result.verification = { ...(result.verification || {}), lint: 'issues found' };
      }
    }

    // Type check
    const typeCmd = detectTypecheckCommand(pkgPath);
    if (typeCmd) {
      try {
        execSync(typeCmd, { cwd: project.rootPath, timeout: 60000, encoding: 'utf-8' });
        result.verification = { ...(result.verification || {}), typecheck: '0 errors' };
      } catch (err: any) {
        result.verification = { ...(result.verification || {}), typecheck: err.stdout?.slice(0, 300) || 'errors found' };
      }
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

/** Simple string replacement for non-diff content */
function applySimpleDiff(filePath: string, newContent: string): string {
  if (fs.existsSync(filePath)) {
    // If file exists and diff is the full new content, use it
    const current = fs.readFileSync(filePath, 'utf-8');
    // Try to interpret diff as full content if it looks like code
    if (newContent.includes('\n') && !newContent.startsWith('@@')) {
      return newContent;
    }
    return current; // Can't parse diff, return unchanged
  }
  return newContent;
}

/** Simple unified diff parser */
function applyUnifiedDiff(currentContent: string, diff: string): string {
  if (!diff.includes('@@')) {
    // Not a proper diff — assume it's full file content
    return diff;
  }

  const lines = diff.split('\n');
  const currentLines = currentContent.split('\n');
  const result: string[] = [];
  let currentLineIdx = 0;
  let hunkIdx = -1;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
      if (match) {
        const oldStart = parseInt(match[1], 10) - 1; // 0-indexed
        const newStart = parseInt(match[3], 10) - 1;

        // Copy lines before hunk unchanged
        if (hunkIdx === -1) {
          while (currentLineIdx < oldStart) {
            result.push(currentLines[currentLineIdx] || '');
            currentLineIdx++;
          }
        }
        hunkIdx++;
      }
      continue;
    }

    if (line.startsWith(' ')) {
      // Context line — keep
      result.push(currentLines[currentLineIdx] || '');
      currentLineIdx++;
    } else if (line.startsWith('-')) {
      // Removed line — skip in result, advance current
      currentLineIdx++;
    } else if (line.startsWith('+')) {
      // Added line — add to result
      result.push(line.slice(1));
    } else {
      // Non-diff line — add as-is
      result.push(line);
    }
  }

  // Copy remaining lines
  while (currentLineIdx < currentLines.length) {
    result.push(currentLines[currentLineIdx]);
    currentLineIdx++;
  }

  return result.join('\n');
}
