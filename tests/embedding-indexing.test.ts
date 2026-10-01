import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const state = vi.hoisted(() => ({ collections: new Map<string, Map<string, { id: string; vector: number[] }>>(), requests: [] as { url: string; body: any }[] }));

vi.mock('../src/services/qdrant.js', async () => {
  const collectionName = async (project: string) => (await import('../src/config.js')).getCollectionName(project);
  return {
    healthCheck: async () => true,
    ensureCollection: async (project: string) => {
      const name = await collectionName(project);
      if (state.collections.has(name)) return false;
      state.collections.set(name, new Map());
      return true;
    },
    deleteCollection: async (project: string) => { state.collections.delete(await collectionName(project)); },
    verifyCollectionReady: async (project: string) => ({ ok: true, pointsCount: state.collections.get(await collectionName(project))?.size ?? 0 }),
    deletePoints: async (project: string, ids: string[]) => { const name = await collectionName(project); for (const id of ids) state.collections.get(name)?.delete(id); },
    upsertPoints: async (project: string, points: { id: string; vector: number[] }[]) => {
      const collection = state.collections.get(await collectionName(project));
      if (!collection) throw new Error('Collection missing');
      for (const point of points) collection.set(point.id, point);
    },
    searchSimilar: async (project: string, _vector: number[], limit: number) => [...(state.collections.get(await collectionName(project))?.values() ?? [])].slice(0, limit).map(point => ({ id: point.id, score: 0.9 })),
  };
});

let temp: string;
let server: http.Server;
let baseUrl: string;
let sqlite: typeof import('../src/services/sqlite.js') | undefined;

beforeEach(async () => {
  vi.resetModules();
  state.collections.clear();
  state.requests = [];
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-provider-integration-'));
  fs.mkdirSync(path.join(temp, 'repo'));
  fs.writeFileSync(path.join(temp, 'repo', 'first.ts'), 'export function providerSearch() { return "first"; }\n');
  fs.writeFileSync(path.join(temp, 'repo', 'second.ts'), 'export function secondResult() { return "second"; }\n');
  server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    state.requests.push({ url: req.url!, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.url?.endsWith('/api/tags')) res.end(JSON.stringify({ models: [] }));
    else if (req.url?.endsWith('/api/embed')) res.end(JSON.stringify({ embeddings: body.input.map(() => [1, 0, 0]) }));
    else if (req.url?.endsWith('/embeddings')) res.end(JSON.stringify({ data: body.input.map((_text: string, index: number) => ({ index, embedding: [1, 0, 0] })).reverse() }));
    else if (req.url?.endsWith(':embedContent')) res.end(JSON.stringify({ embedding: { values: [1, 0, 0] } }));
    else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  vi.stubEnv('STORAGE_PATH', path.join(temp, 'storage'));
  vi.stubEnv('EMBEDDING_BASE_URL', baseUrl);
  vi.stubEnv('EMBEDDING_API_KEY', 'local-integration-key');
  vi.stubEnv('EMBEDDING_MODEL', '');
  vi.stubEnv('EMBEDDING_DIMENSIONS', '3');
  vi.stubEnv('EMBEDDING_BATCH_SIZE', '2');
  vi.stubEnv('INDEX_WORKERS', '2');
  vi.stubEnv('INDEX_PARALLEL_BATCH', '1');
  vi.stubEnv('WATCH_AUTO_RESUME', 'false');
  vi.stubEnv('CHAT_MEMORY_ENABLED', 'false');
  vi.stubEnv('SEARCH_STREAM_ENABLED', 'false');
});

afterEach(async () => {
  sqlite?.getDb().close();
  sqlite = undefined;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  fs.rmSync(temp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function initialize(provider: string) {
  vi.stubEnv('EMBEDDING_PROVIDER', provider);
  vi.stubEnv('EMBEDDING_MODEL', provider === 'openai-compatible' ? 'custom-model' : '');
  vi.resetModules();
  sqlite = await import('../src/services/sqlite.js');
  sqlite.initDatabase();
  return {
    ...(await import('../src/tools/index-codebase.js')),
    ...(await import('../src/tools/search.js')),
    ...(await import('../src/config.js')),
  };
}

describe('embedding providers through real HTTP and indexing workers', () => {
  it.each(['ollama', 'openai', 'voyage', 'gemini', 'openai-compatible'])('indexes, searches and skips unchanged files with %s', async provider => {
    const api = await initialize(provider);
    const args = { path: path.join(temp, 'repo'), project_name: 'demo', watch: false };
    const indexed = await api.indexCodebase(args);
    expect(indexed.content[0].text).toContain('Ready: yes');
    expect(indexed.content[0].text).toContain('Files indexed: 2');
    expect(sqlite!.getProjectEmbeddingProfile('demo')).toBe(api.getEmbeddingProfile());
    const chunks = sqlite!.getAllProjectChunks('demo');
    expect(chunks).toHaveLength(2);
    expect([...state.collections.get(api.getCollectionName('demo'))!.keys()].sort()).toEqual(chunks.map(chunk => chunk.id).sort());
    const result = await api.search({ query: 'providerSearch', project_name: 'demo', mode: 'semantic', rerank: false });
    expect(result.content[0].text).toContain('first.ts');
    const before = state.requests.length;
    const reindexed = await api.indexCodebase(args);
    expect(reindexed.content[0].text).toContain('Files unchanged (skipped): 2');
    expect(state.requests.length).toBe(before);
    expect(state.requests.some(request => request.url.endsWith('/api/tags'))).toBe(provider === 'ollama');
  });

  it('re-embeds unchanged sources when switching provider and switching back', async () => {
    const args = { path: path.join(temp, 'repo'), project_name: 'demo', watch: false };
    const openai = await initialize('openai');
    expect((await openai.indexCodebase(args)).content[0].text).toContain('Ready: yes');
    const firstNamespace = openai.getCollectionName('demo');
    sqlite!.getDb().close();
    const voyage = await initialize('voyage');
    expect((await voyage.indexCodebase(args)).content[0].text).toContain('Files indexed: 2');
    expect(state.collections.size).toBe(2);
    sqlite!.getDb().close();
    const back = await initialize('openai');
    const result = await back.indexCodebase(args);
    expect(result.content[0].text).toContain('Ready: yes');
    expect(result.content[0].text).toContain('Files indexed: 2');
    const ids = sqlite!.getAllProjectChunks('demo').map(chunk => chunk.id).sort();
    expect([...state.collections.get(firstNamespace)!.keys()].sort()).toEqual(ids);
  });

  it('retries every file after an interrupted migration profile', async () => {
    const api = await initialize('voyage');
    const args = { path: path.join(temp, 'repo'), project_name: 'demo', watch: false };
    await api.indexCodebase(args);
    sqlite!.setProjectEmbeddingProfile('demo', `pending:${api.getEmbeddingProfile()}`);
    const result = await api.indexCodebase(args);
    expect(result.content[0].text).toContain('Files indexed: 2');
    expect(result.content[0].text).toContain('Ready: yes');
    expect(sqlite!.getProjectEmbeddingProfile('demo')).toBe(api.getEmbeddingProfile());
  });
});
