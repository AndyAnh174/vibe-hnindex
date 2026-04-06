import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitCommit } from '../types.js';

const execFile = promisify(execFileCb);

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    await runGit(dirPath, ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

export async function getRecentCommits(
  dirPath: string,
  days: number,
  limit: number
): Promise<GitCommit[]> {
  try {
    const output = await runGit(dirPath, [
      'log',
      `--since=${days} days ago`,
      `--max-count=${limit}`,
      '--format=%H|%h|%an|%aI|%s',
      '--name-only',
    ]);

    return parseGitLogOutput(output);
  } catch {
    return [];
  }
}

export async function getFileHistory(
  dirPath: string,
  filePath: string,
  limit: number
): Promise<GitCommit[]> {
  try {
    const output = await runGit(dirPath, [
      'log',
      `--max-count=${limit}`,
      '--format=%H|%h|%an|%aI|%s',
      '--name-only',
      '--',
      filePath,
    ]);

    return parseGitLogOutput(output);
  } catch {
    return [];
  }
}

function parseGitLogOutput(output: string): GitCommit[] {
  const commits: GitCommit[] = [];
  const blocks = output.trim().split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;

    const parts = lines[0].split('|');
    if (parts.length < 5) continue;

    const files = lines.slice(1)
      .map(f => f.trim().replace(/\\/g, '/'))
      .filter(f => f.length > 0);

    commits.push({
      hash: parts[0],
      shortHash: parts[1],
      author: parts[2],
      date: parts[3],
      message: parts.slice(4).join('|'),
      files,
    });
  }

  return commits;
}
