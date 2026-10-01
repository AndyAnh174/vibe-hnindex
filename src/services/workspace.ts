import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDb, getProject, listProjects } from './sqlite.js';
import type { ProjectInfo } from '../types.js';
import { fastHash } from './fast-hash.js';
import { loadHnindexIgnore, isIgnored } from './hnindex-ignore.js';

export type WorkspaceArgs = { project_name?: string; path?: string };
export type Workspace = { root: string; project: ProjectInfo | null; source: string };
export type WorkspaceResolution = Workspace | { error: string; choices: Array<{ project_name?: string; path: string }> };
export function canonicalPath(root: string): string {
  try { return fs.realpathSync(root); } catch { return path.resolve(root); }
}
export function withinPath(root: string, target: string): boolean {
  const relative = path.relative(canonicalPath(root), canonicalPath(target));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export function resolveWorkspace(args: WorkspaceArgs, roots: string[] = []): WorkspaceResolution {
  const projects = listProjects();
  if (args.project_name) {
    const project = getProject(args.project_name);
    if (!project) return { error: 'Project not indexed. Run index_code_graph or index_codebase with an explicit path.', choices: [] };
    if (args.path && !withinPath(project.rootPath, args.path)) return { error: 'path does not belong to project_name.', choices: [] };
    return { root: canonicalPath(project.rootPath), project, source: 'project_name' };
  }
  const configured = process.env.HNINDEX_PROJECT_ROOT?.trim();
  const candidates = args.path ? [args.path] : configured ? [configured] : roots.length ? roots :
    projects.some(project => withinPath(project.rootPath, process.cwd())) ? [process.cwd()] : [];
  const valid = [...new Set(candidates.flatMap(candidate => {
    try {
      const root = canonicalPath(candidate.startsWith('file:') ? fileURLToPath(candidate) : candidate);
      return fs.statSync(root).isDirectory() ? [root] : [];
    } catch { return []; }
  }))];
  const source = args.path ? 'path' : configured ? 'HNINDEX_PROJECT_ROOT' : roots.length ? 'client_roots' : 'indexed_cwd';
  if (valid.length !== 1) return { error: valid.length ? 'Multiple workspace roots. Select path or project_name explicitly.' : 'Workspace unavailable. Supply path/project_name or configure HNINDEX_PROJECT_ROOT.', choices: valid.map(root => ({ path: root })) };
  const matches = projects.filter(project => withinPath(project.rootPath, valid[0])).sort((a,b) => canonicalPath(b.rootPath).length - canonicalPath(a.rootPath).length);
  const deepest = matches.filter(project => canonicalPath(project.rootPath) === (matches[0] && canonicalPath(matches[0].rootPath)));
  if (deepest.length > 1) return { error: 'Multiple project names share this root. Select project_name.', choices: deepest.map(project => ({ project_name: project.projectName, path: project.rootPath })) };
  const project = matches[0] ?? null;
  return { root: project ? canonicalPath(project.rootPath) : valid[0], project, source };
}

/** Reads only bounded repository files; rejects ignored paths and symlinks leaving the root. */
export function readWorkspaceFile(root: string, relative: string, maxBytes = 65536): string | null {
  if (isIgnored(relative, loadHnindexIgnore(root))) return null;
  const target = path.resolve(root, relative);
  if (!withinPath(root, target)) return null;
  try {
    const stat = fs.statSync(target);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const content = fs.readFileSync(target, 'utf8');
    return content.includes('\0') ? null : content;
  } catch { return null; }
}
export function projectFiles(projectName: string): string[] {
  return (getDb().prepare('SELECT file_path FROM chunks WHERE project_name = ? UNION SELECT file_path FROM code_graph_sources WHERE project_name = ? ORDER BY file_path')
    .all(projectName, projectName) as Array<{ file_path: string }>).map(row => row.file_path);
}
export function taskState(projectName: string, sessionId: string, task?: string, clear = false) {
  const db = getDb();
  if (task && clear) throw new Error('Use task or clear_task, not both.');
  if (clear) db.prepare('DELETE FROM agent_workspace_tasks WHERE project_name = ? AND session_id = ?').run(projectName, sessionId);
  if (task) db.prepare('INSERT INTO agent_workspace_tasks(project_name, session_id, task, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_name, session_id) DO UPDATE SET task=excluded.task, updated_at=excluded.updated_at')
    .run(projectName, sessionId, task, new Date().toISOString());
  return db.prepare('SELECT task, updated_at AS updatedAt FROM agent_workspace_tasks WHERE project_name = ? AND session_id = ?').get(projectName, sessionId) as { task: string; updatedAt: string } | undefined;
}
const exec = promisify(execFile);
export async function workspaceGit(root: string) {
  const run = async (args: string[]) => {
    try { return (await exec('git', args, { cwd: root, encoding: 'utf8', timeout: 2000, maxBuffer: 256 * 1024 })).stdout.trim(); }
    catch { return null; }
  };
  const [head, branch, status] = await Promise.all([run(['rev-parse', 'HEAD']), run(['branch', '--show-current']), run(['status', '--porcelain=v1', '--untracked-files=no'])]);
  return { head, branch, changedFiles: status?.split('\n').filter(Boolean).slice(0, 30) ?? [], note: 'Git state is evidence of changes, not a statement of user intent. Untracked files are omitted.' };
}
export function snapshotHash(content: string): string { return fastHash(content); }
