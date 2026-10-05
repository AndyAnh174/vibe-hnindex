import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let temp: string, root: string, other: string;
let sqlite: typeof import('../src/services/sqlite.js');
let workspace: typeof import('../src/services/workspace.js');
let context: typeof import('../src/tools/workspace-context.js');
let locator: typeof import('../src/tools/locate-code.js');
let graph: typeof import('../src/services/code-graph-store.js');
let tokenCount: typeof import('../src/tools/code-graph.js').graphTokenCount;
const sources = [
  { filePath: 'util.ts', content: 'export function target() { return 1; }' },
  { filePath: 'main.ts', content: "import { target } from './util';\nexport function entry() { return target(); }" },
];
const json = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);
beforeAll(async () => {
  vi.resetModules();
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-workspace-'));
  root = path.join(temp, 'repo'); other = path.join(temp, 'other');
  fs.mkdirSync(root); fs.mkdirSync(other);
  vi.stubEnv('STORAGE_PATH', path.join(temp, 'storage'));
  vi.stubEnv('CODE_GRAPH_ENABLED', 'true'); vi.stubEnv('CHAT_MEMORY_ENABLED', 'false');
  vi.stubEnv('WATCH_AUTO_RESUME', 'false'); vi.stubEnv('HNINDEX_PROJECT_ROOT', '');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  sqlite = await import('../src/services/sqlite.js'); sqlite.initDatabase();
  workspace = await import('../src/services/workspace.js');
  context = await import('../src/tools/workspace-context.js');
  locator = await import('../src/tools/locate-code.js');
  graph = await import('../src/services/code-graph-store.js');
  tokenCount = (await import('../src/tools/code-graph.js')).graphTokenCount;
});
beforeEach(() => {
  for (const project of sqlite.listProjects()) sqlite.deleteProject(project.projectName);
  vi.stubEnv('HNINDEX_PROJECT_ROOT', '');
  fs.rmSync(path.join(root, '.hnindexignore'), { force: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', description: 'Second brain for code agents' }));
  fs.writeFileSync(path.join(root, 'README.md'), '# Fixture\nSearch and remember project context.');
  for (const source of sources) fs.writeFileSync(path.join(root, source.filePath), source.content);
  sqlite.upsertProject('p', root); graph.syncCodeGraph('p', root, sources);
});
afterAll(() => {
  sqlite?.getDb().close();
  // Test-owned mkdtemp path, never a user workspace.
  if (temp && path.basename(temp).startsWith('hnindex-workspace-')) fs.rmSync(temp, { recursive: true, force: true });
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
describe('active workspace selection and declared tasks', () => {
  it('uses client file URI roots and live purpose documents without network', async () => {
    const result = json(await context.workspaceContextTool({}, [pathToFileURL(root).href]));
    expect(result).toMatchObject({ project: 'p', selectedBy: 'client_roots', purpose: { text: 'Second brain for code agents' }, currentTask: null, index: { graphReady: true, embeddingProfileReady: false } });
    expect(result.modules).toContainEqual({ directory: '<root>', indexedFiles: 2 });
    expect(fetch).not.toHaveBeenCalled();
    fs.writeFileSync(path.join(root, 'package.json'), '{"description":"Updated purpose"}');
    expect(json(await context.workspaceContextTool({ project_name: 'p' })).purpose.text).toBe('Updated purpose');
  });
  it('does not select the only indexed project when the client opens another workspace', async () => {
    const result = json(await context.workspaceContextTool({}, [pathToFileURL(other).href]));
    expect(result.project).toBeNull(); expect(result.workspace).toBe(workspace.canonicalPath(other));
    expect(json(await locator.locateCodeTool({ query: 'target' }, [pathToFileURL(other).href])).error).toContain('not indexed');
  });
  it('requires explicit choice for multiple roots, including indexed/unindexed pairs', () => {
    expect(workspace.resolveWorkspace({}, [root, other])).toMatchObject({ error: expect.stringContaining('Multiple'), choices: [{ path: root }, { path: other }] });
    expect(workspace.resolveWorkspace({ project_name: 'p' }, [root, other])).toMatchObject({ project: { projectName: 'p' } });
  });
  it('gives explicit paths precedence over configured roots and detects mismatched names', () => {
    vi.stubEnv('HNINDEX_PROJECT_ROOT', root);
    expect(workspace.resolveWorkspace({}, [other])).toMatchObject({ project: { projectName: 'p' }, source: 'HNINDEX_PROJECT_ROOT' });
    expect(workspace.resolveWorkspace({ path: other }, [root])).toMatchObject({ project: null, source: 'path' });
    expect(workspace.resolveWorkspace({ project_name: 'p', path: other })).toHaveProperty('error');
  });
  it('asks for names sharing one root and chooses the deepest indexed project', () => {
    sqlite.upsertProject('alias', root);
    expect(workspace.resolveWorkspace({ path: root })).toMatchObject({ error: expect.stringContaining('Multiple project names') });
    sqlite.deleteProject('alias');
    const nested = path.join(root, 'nested'); fs.mkdirSync(nested, { recursive: true }); sqlite.upsertProject('nested', nested);
    expect(workspace.resolveWorkspace({ path: nested })).toMatchObject({ project: { projectName: 'nested' } });
  });
  it('persists tasks across DB reopen, separates sessions/projects and cascades deletion', async () => {
    await context.workspaceContextTool({ project_name: 'p', task: 'Implement locator', session_id: 'agent-a' });
    sqlite.getDb().close(); sqlite.initDatabase();
    expect(json(await context.workspaceContextTool({ project_name: 'p', session_id: 'agent-a' })).currentTask.task).toBe('Implement locator');
    expect(json(await context.workspaceContextTool({ project_name: 'p', session_id: 'agent-b' })).currentTask).toBeNull();
    sqlite.upsertProject('q', other);
    expect(json(await context.workspaceContextTool({ project_name: 'q', session_id: 'agent-a' })).currentTask).toBeNull();
    await context.workspaceContextTool({ project_name: 'p', session_id: 'agent-a', clear_task: true });
    expect(workspace.taskState('p', 'agent-a')).toBeUndefined();
    workspace.taskState('p', 'agent-a', 'Finish'); sqlite.deleteProject('p');
    expect(sqlite.getDb().prepare('SELECT * FROM agent_workspace_tasks').all()).toEqual([]);
  });
  it('does not invent a task and rejects simultaneous save/clear', async () => {
    expect(json(await context.workspaceContextTool({ project_name: 'p' })).currentTask).toBeNull();
    expect((await context.workspaceContextTool({ project_name: 'p', task: 'Build', clear_task: true })).content[0].text).toContain('not both');
  });
});
describe('code locations and freshness', () => {
  it('finds exact definitions and resolved callers offline', async () => {
    const result = json(await locator.locateCodeTool({ query: 'target' }, [root]));
    expect(result.locations[0]).toMatchObject({ file: 'util.ts', line: 1, symbol: 'target', freshness: 'fresh', origin: 'graph' });
    expect(result.relations).toContainEqual(expect.objectContaining({ kind: 'CALLS', file: 'main.ts', line: 2, freshness: 'fresh', targetFreshness: 'fresh' }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('finds known file paths and reports duplicate basenames rather than guessing', async () => {
    const nested = path.join(root, 'nested'); fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'util.ts'), sources[0].content);
    graph.syncCodeGraph('p', root, [...sources, { ...sources[0], filePath: 'nested/util.ts' }]);
    expect(json(await locator.locateCodeTool({ project_name: 'p', query: 'util.ts' })).locations).toHaveLength(2);
    expect(json(await locator.locateCodeTool({ project_name: 'p', query: 'nested/util.ts' })).locations).toHaveLength(1);
  });
  it('marks changed definitions stale, preserves snapshot evidence and removes relationships', async () => {
    fs.writeFileSync(path.join(root, 'util.ts'), '// shifted\n' + sources[0].content);
    const result = json(await locator.locateCodeTool({ project_name: 'p', symbol: 'target' }));
    expect(result.locations[0]).toMatchObject({ line: 1, freshness: 'stale', excerpt: sources[0].content });
    expect(result.relations).toEqual([]);
    graph.syncCodeGraph('p', root, [{ ...sources[0], content: '// shifted\n' + sources[0].content }, sources[1]]);
    expect(json(await locator.locateCodeTool({ project_name: 'p', symbol: 'target' })).locations[0]).toMatchObject({ line: 2, freshness: 'fresh' });
  });
  it('checks changed consumer and target files for relationship freshness', async () => {
    fs.writeFileSync(path.join(root, 'util.ts'), 'export function replacement() {}');
    const result = json(await locator.locateCodeTool({ project_name: 'p', symbol: 'entry' }));
    expect(result.locations[0].freshness).toBe('fresh');
    expect(result.relations).toContainEqual(expect.objectContaining({ kind: 'CALLS', target: 'target', freshness: 'stale', targetFreshness: 'stale' }));
  });
  it('reports ambiguous symbols and disambiguates with file_pattern', async () => {
    fs.writeFileSync(path.join(root, 'other.ts'), sources[0].content);
    graph.syncCodeGraph('p', root, [...sources, { ...sources[0], filePath: 'other.ts' }]);
    expect(json(await locator.locateCodeTool({ project_name: 'p', symbol: 'target' }))).toMatchObject({ ambiguousSymbol: true, relations: [] });
    const selected = json(await locator.locateCodeTool({ project_name: 'p', symbol: 'target', file_pattern: 'util.ts' }));
    expect(selected.ambiguousSymbol).toBe(false); expect(selected.locations).toHaveLength(1);
    expect(selected.relations).toContainEqual(expect.objectContaining({ kind: 'CALLS', file: 'main.ts' }));
  });
  it('honors current exclusions and omits source from missing files', async () => {
    fs.writeFileSync(path.join(root, '.hnindexignore'), 'util.ts\n');
    expect(json(await locator.locateCodeTool({ project_name: 'p', symbol: 'target' })).locations).toEqual([]);
    fs.rmSync(path.join(root, '.hnindexignore')); fs.rmSync(path.join(root, 'util.ts'));
    const result = json(await locator.locateCodeTool({ project_name: 'p', symbol: 'target' }));
    expect(result.locations[0].freshness).toBe('missing_or_excluded'); expect(result.locations[0]).not.toHaveProperty('excerpt');
  });
  it('rejects traversal and symlink reads outside the selected project', () => {
    fs.writeFileSync(path.join(other, 'secret.txt'), 'outside');
    expect(workspace.readWorkspaceFile(root, '../other/secret.txt')).toBeNull();
    const link = path.join(root, 'external'); fs.symlinkSync(other, link, process.platform === 'win32' ? 'junction' : 'dir');
    expect(workspace.readWorkspaceFile(root, 'external/secret.txt')).toBeNull(); fs.unlinkSync(link);
  });
  it('falls back to SQLite keyword chunks for non-graph languages without API calls', async () => {
    const content = 'def authenticate():\n    return "jwt validation"'; const file = 'auth.py';
    fs.writeFileSync(path.join(root, file), content);
    sqlite.insertChunks([{ id: 'python', projectName: 'p', filePath: file, absolutePath: path.join(root, file), chunkIndex: 0,
      startLine: 1, endLine: 2, content, language: 'python', fileHash: workspace.snapshotHash(content), indexedAt: new Date().toISOString() }]);
    const result = json(await locator.locateCodeTool({ project_name: 'p', query: 'jwt validation' }));
    expect(result.locations[0]).toMatchObject({ file, origin: 'keyword', freshness: 'fresh' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps explicit symbol lookup exact for non-graph languages', async () => {
    const content = 'def authenticate():\n    return True';
    const { extractSymbols, toSymbolRecords } = await import('../src/services/symbol-extractor.js');
    fs.writeFileSync(path.join(root, 'auth.py'), content);
    sqlite.insertSymbols(toSymbolRecords('p', 'auth.py', 'python', extractSymbols(content, 'python')));
    expect(json(await locator.locateCodeTool({ project_name: 'p', symbol: 'auth' })).locations).toEqual([]);
    expect(json(await locator.locateCodeTool({ project_name: 'p', symbol: 'authenticate' })).locations[0]).toMatchObject({ symbol: 'authenticate', origin: 'symbol_index', freshness: 'unverified' });
  });
  it('bounds successful, empty and Unicode responses by the requested token budget', async () => {
    for (const budget of [512, 1000]) {
      const results = [await context.workspaceContextTool({ project_name: 'p', token_budget: budget }),
        await locator.locateCodeTool({ project_name: 'p', symbol: 'target', token_budget: budget }),
        await locator.locateCodeTool({ project_name: 'p', query: 'Tiếng Việt 中文 '.repeat(30), token_budget: budget })];
      for (const result of results) expect(tokenCount(result.content[0].text)).toBeLessThanOrEqual(budget);
      expect(json(results[1]).locations[0]).toMatchObject({ file: 'util.ts', line: 1 });
    }
  });
});
