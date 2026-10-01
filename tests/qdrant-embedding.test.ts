import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  client: { getCollection: vi.fn(), createCollection: vi.fn(), search: vi.fn() },
  getProjectEmbeddingProfile: vi.fn(),
}));
vi.mock('@qdrant/js-client-rest', () => ({ QdrantClient: class { constructor() { return mocks.client; } } }));
vi.mock('../src/services/sqlite.js', () => ({ getProjectEmbeddingProfile: mocks.getProjectEmbeddingProfile }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
  vi.stubEnv('EMBEDDING_MODEL', '');
  vi.stubEnv('EMBEDDING_BASE_URL', '');
  vi.stubEnv('EMBEDDING_DIMENSIONS', '3');
  mocks.client.getCollection.mockReset();
  mocks.client.createCollection.mockResolvedValue(true);
  mocks.client.search.mockResolvedValue([]);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('Qdrant vector space compatibility', () => {
  it('creates a new collection only on HTTP 404', async () => {
    mocks.client.getCollection.mockRejectedValue({ status: 404 });
    const api = await import('../src/services/qdrant.js');
    expect(await api.ensureCollection('demo')).toBe(true);
    expect(mocks.client.createCollection).toHaveBeenCalledWith(expect.stringMatching(/^mcp_ck_demo_/), expect.objectContaining({ vectors: { size: 3, distance: 'Cosine' } }));
  });

  it('retains a compatible collection', async () => {
    mocks.client.getCollection.mockResolvedValue({ config: { params: { vectors: { size: 3 } } } });
    expect(await (await import('../src/services/qdrant.js')).ensureCollection('demo')).toBe(false);
    expect(mocks.client.createCollection).not.toHaveBeenCalled();
  });

  it('rejects mismatched dimensions without attempting collection creation', async () => {
    mocks.client.getCollection.mockResolvedValue({ config: { params: { vectors: { size: 1024 } } } });
    await expect((await import('../src/services/qdrant.js')).ensureCollection('demo')).rejects.toThrow('dimensions');
    expect(mocks.client.createCollection).not.toHaveBeenCalled();
  });

  it.each([{ status: 401 }, new Error('Network down')])('propagates auth/connection failures %#', async error => {
    mocks.client.getCollection.mockRejectedValue(error);
    await expect((await import('../src/services/qdrant.js')).ensureCollection('demo')).rejects.toBe(error);
    expect(mocks.client.createCollection).not.toHaveBeenCalled();
  });

  it('blocks semantic queries against a previous or pending embedding profile', async () => {
    mocks.getProjectEmbeddingProfile.mockReturnValue('legacy-ollama');
    const api = await import('../src/services/qdrant.js');
    await expect(api.searchSimilar('demo', [1, 0, 0], 5)).rejects.toThrow('Run index_codebase');
    expect(mocks.client.search).not.toHaveBeenCalled();
  });

  it('applies the same model namespace to code and chat vectors', async () => {
    const api = await import('../src/services/qdrant.js');
    const config = await import('../src/config.js');
    expect(api.getChatCollectionName('demo')).toBe(`mcp_ck_chat_demo${config.getEmbeddingNamespace()}`);
  });
});
