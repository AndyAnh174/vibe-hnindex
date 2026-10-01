import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let temp: string;
let sqlite: typeof import('../src/services/sqlite.js');
let store: typeof import('../src/services/code-graph-store.js');
let tools: typeof import('../src/tools/code-graph.js');
const sources = [
  { filePath: 'util.ts', content: 'export function target() { return 1; }' },
  { filePath: 'main.ts', content: "import { target } from './util';\nexport function entry() { return target(); }" },
];
beforeEach(async () => {
  vi.resetModules();
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-graph-'));
  vi.stubEnv('STORAGE_PATH', path.join(temp, 'storage'));
  vi.stubEnv('CODE_GRAPH_ENABLED', 'true');
  vi.stubEnv('WATCH_AUTO_RESUME', 'false');
  vi.stubEnv('RERANK_PROVIDER', 'none');
  sqlite = await import('../src/services/sqlite.js');
  sqlite.initDatabase();
  sqlite.upsertProject('p', temp);
  store = await import('../src/services/code-graph-store.js');
  tools = await import('../src/tools/code-graph.js');
  store.syncCodeGraph('p', temp, sources);
});
afterEach(() => {
  sqlite?.getDb().close();
  fs.rmSync(temp, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('graph storage and tools', () => {
  it('returns references and callers with exact evidence', () => {
    const args = { project_name: 'p', symbol: 'target' };
    expect(tools.callersTool(args).content[0].text).toContain('main.ts:2:');
    expect(tools.callersTool(args).content[0].text).toContain('entry → target');
    expect(tools.findReferencesTool(args).content[0].text).toContain('[REFERENCES, resolved]');
  });
  it('does not duplicate nodes/edges and skips unchanged resolution', () => {
    const counts = store.graphCounts('p');
    const second = store.syncCodeGraph('p', temp, sources);
    expect(second.rebuilt).toBe(false);
    expect(store.graphCounts('p')).toEqual(counts);
  });
  it('re-resolves unchanged consumers when an export changes', () => {
    store.updateCodeGraphFile('p', temp, 'util.ts', 'export function replacement() {}');
    expect(store.findGraphNodes('p', { symbol: 'target' })).toEqual([]);
    const entry = store.findGraphNodes('p', { symbol: 'entry' })[0];
    const calls = store.graphEdges('p', [entry.id], 'outgoing', ['CALLS'], 10);
    expect(calls).toHaveLength(1);
    expect(calls[0].resolution).toBe('unresolved');
  });
  it('removes deleted targets and keeps unresolved call-site evidence', () => {
    store.updateCodeGraphFile('p', temp, 'util.ts', null);
    expect(store.graphSources('p').map(source => source.filePath)).toEqual(['main.ts']);
    expect(store.findGraphNodes('p', { file_path: 'util.ts' })).toEqual([]);
    expect(store.graphCounts('p').unresolved).toBeGreaterThan(0);
  });
  it('full sync removes deleted and excluded files', () => {
    store.syncCodeGraph('p', temp, [sources[0]]);
    expect(tools.callersTool({ project_name: 'p', symbol: 'target' }).content[0].text).toContain('No resolved relationships');
    expect(store.graphSources('p')).toEqual([sources[0]]);
  });
  it('invalidates prior edges after compiler configuration fails', () => {
    fs.writeFileSync(path.join(temp, 'tsconfig.json'), '{ invalid json');
    expect(() => store.updateCodeGraphFile('p', temp, 'main.ts', 'export function empty() {}')).toThrow();
    expect(store.graphState('p')).toBeNull();
    expect(tools.callersTool({ project_name: 'p', symbol: 'target' }).content[0].text).toContain('unavailable');
  });
  it('fingerprints compiler options and resolves a changed path alias', () => {
    fs.writeFileSync(path.join(temp, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      baseUrl: '.', paths: { '@util': ['./util.ts'] }, module: 'ESNext', moduleResolution: 'Bundler',
    } }));
    store.updateCodeGraphFile('p', temp, 'main.ts', "import { target } from '@util'; target();");
    expect(store.graphCounts('p').unresolved).toBe(0);
    fs.writeFileSync(path.join(temp, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@util': ['./missing.ts'] } } }));
    expect(store.refreshCodeGraph('p', temp).rebuilt).toBe(true);
    expect(store.graphCounts('p').unresolved).toBeGreaterThan(0);
  });
  it('asks for disambiguation rather than combining same-name symbols', () => {
    store.updateCodeGraphFile('p', temp, 'other.ts', 'export function target() {}');
    expect(tools.callersTool({ project_name: 'p', symbol: 'target' }).content[0].text).toContain('Ambiguous');
    expect(tools.callersTool({ project_name: 'p', symbol: 'target', file_path: 'util.ts' }).content[0].text).toContain('entry → target');
  });
  it('bounds traversal, avoids cycles and enforces measured token budgets including Unicode', async () => {
    const node = store.findGraphNodes('p', { symbol: 'target' })[0];
    const graph = store.traverseCodeGraph('p', [node], { depth: 3, maxNodes: 2 });
    expect(graph.nodes.length).toBeLessThanOrEqual(2);
    expect(new Set(graph.nodes.map(node => node.id)).size).toBe(graph.nodes.length);
    expect(graph.truncated).toBe(true);
    for (const budget of [256, 1000]) {
      const response = await tools.graphContextTool({ project_name: 'p', symbol: 'target', token_budget: budget, depth: 2 });
      expect(tools.graphTokenCount(response.content[0].text)).toBeLessThanOrEqual(budget);
      expect(response.content[0].text).toContain('main.ts:2:');
    }
    expect(tools.graphTokenCount('Tiếng Việt 中文 <|endoftext|>')).toBeGreaterThan(0);
  });
  it('isolates projects and cleans all graph data on project deletion', () => {
    sqlite.upsertProject('other', temp);
    store.syncCodeGraph('other', temp, sources);
    sqlite.deleteProject('p');
    expect(store.graphSources('p')).toEqual([]);
    expect(store.graphCounts('p')).toEqual({ nodes: 0, edges: 0, unresolved: 0 });
    expect(store.graphCounts('other').nodes).toBeGreaterThan(0);
  });

  it('rejects query seeds from stale chunks and accepts matching snapshots', async () => {
    const hit = { id: 'seed', filePath: 'util.ts', absolutePath: path.join(temp, 'util.ts'), chunkIndex: 0,
      startLine: 1, endLine: 1, content: sources[0].content, language: 'typescript', score: 1, matchType: 'keyword' as const };
    sqlite.insertChunks([{ ...hit, projectName: 'p', fileHash: 'outdated-hash', indexedAt: new Date().toISOString() }]);
    const searchModule = await import('../src/tools/search.js');
    vi.spyOn(searchModule, 'search').mockImplementation(async (_args, context) => {
      context?.onResults?.([hit]); return { content: [{ type: 'text', text: 'Found 1 results' }] };
    });
    expect((await tools.graphContextTool({ project_name: 'p', query: 'target' })).content[0].text).toContain('snapshots differ');
    const { fastHash } = await import('../src/services/fast-hash.js');
    sqlite.insertChunks([{ ...hit, projectName: 'p', fileHash: fastHash(sources[0].content), indexedAt: new Date().toISOString() }]);
    expect((await tools.graphContextTool({ project_name: 'p', query: 'target' })).content[0].text).toContain('entry CALLS target');
  });
  it('indexes offline and honors .hnindexignore', async () => {
    for (const source of sources) fs.writeFileSync(path.join(temp, source.filePath), source.content);
    fs.writeFileSync(path.join(temp, '.hnindexignore'), 'util.ts\n');
    const fetch = vi.fn(() => { throw new Error('Network forbidden'); });
    vi.stubGlobal('fetch', fetch);
    try {
      const response = await tools.indexCodeGraphTool({ project_name: 'p', path: temp });
      expect(response.content[0].text).toContain('Files: 1');
      expect(store.graphSources('p').map(source => source.filePath)).toEqual(['main.ts']);
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
