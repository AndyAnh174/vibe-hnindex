import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  for (const name of ['EMBEDDING_PROVIDER', 'EMBEDDING_MODEL', 'EMBEDDING_DIMENSIONS', 'EMBEDDING_BASE_URL', 'EMBEDDING_API_KEY', 'OPENAI_API_KEY', 'VOYAGE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OLLAMA_MODEL', 'OLLAMA_URL']) vi.stubEnv(name, '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('embedding configuration and collection migration', () => {
  it.each([
    ['ollama', 'bge-m3:567m', 1024],
    ['openai', 'text-embedding-3-small', 1536],
    ['voyage', 'voyage-code-3', 1024],
    ['gemini', 'gemini-embedding-2', 3072],
  ])('selects defaults for %s without leaking Ollama model settings', async (provider, model, dimensions) => {
    vi.stubEnv('EMBEDDING_PROVIDER', provider as string);
    if (provider !== 'ollama') vi.stubEnv('OLLAMA_MODEL', 'legacy-ollama-model');
    const { config } = await import('../src/config.js');
    expect(config.embeddingModel).toBe(model);
    expect(config.embeddingDimensions).toBe(dimensions);
  });

  it('preserves historical collection names for the default Ollama setup', async () => {
    const { getCollectionName, getEmbeddingProfile } = await import('../src/config.js');
    expect(getCollectionName('my-project')).toBe('mcp_ck_my_project');
    expect(getEmbeddingProfile()).toBe('legacy-ollama');
  });

  it('separates equal-dimension vector spaces for different providers and models', async () => {
    vi.stubEnv('EMBEDDING_DIMENSIONS', '1024');
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    const first = (await import('../src/config.js')).getCollectionName('demo');
    vi.stubEnv('EMBEDDING_MODEL', 'text-embedding-3-large');
    vi.resetModules();
    const second = (await import('../src/config.js')).getCollectionName('demo');
    vi.stubEnv('EMBEDDING_PROVIDER', 'voyage');
    vi.stubEnv('EMBEDDING_MODEL', 'voyage-code-3');
    vi.resetModules();
    const third = (await import('../src/config.js')).getCollectionName('demo');
    expect(new Set([first, second, third]).size).toBe(3);
  });

  it('keeps vector namespaces stable across API key rotation', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'voyage');
    vi.stubEnv('VOYAGE_API_KEY', 'first-key');
    const first = (await import('../src/config.js')).getCollectionName('demo');
    vi.stubEnv('VOYAGE_API_KEY', 'second-key');
    vi.resetModules();
    expect((await import('../src/config.js')).getCollectionName('demo')).toBe(first);
  });
});
