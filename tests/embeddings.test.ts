import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const jsonResponse = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
const indexed = (rows: number[][]) => ({ data: rows.map((embedding, index) => ({ index, embedding })) });
const load = () => import('../src/services/embeddings.js');
const requestBody = (index = 0) => JSON.parse(fetchMock.mock.calls[index][1].body);

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  for (const name of ['EMBEDDING_PROVIDER', 'EMBEDDING_MODEL', 'EMBEDDING_BASE_URL', 'EMBEDDING_API_KEY', 'OPENAI_API_KEY', 'VOYAGE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_BASE_URL', 'VOYAGE_BASE_URL', 'GEMINI_BASE_URL', 'OLLAMA_MODEL', 'OLLAMA_URL', 'OLLAMA_TIMEOUT_MS']) vi.stubEnv(name, '');
  vi.stubEnv('EMBEDDING_DIMENSIONS', '3');
  vi.stubEnv('EMBEDDING_BATCH_SIZE', '32');
  vi.stubEnv('EMBEDDING_TIMEOUT_MS', '1000');
  vi.stubEnv('EMBEDDING_MAX_RETRIES', '2');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('embedding providers', () => {
  it('preserves the Ollama API and legacy variables', async () => {
    vi.stubEnv('OLLAMA_MODEL', 'custom-ollama');
    vi.stubEnv('OLLAMA_URL', 'http://localhost:11434/');
    fetchMock.mockResolvedValue(jsonResponse({ embeddings: [[1, 2, 3]] }));
    expect(await (await load()).embed(['code'])).toEqual([[1, 2, 3]]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/embed');
    expect(requestBody()).toEqual({ model: 'custom-ollama', input: ['code'] });
  });

  it('uses OpenAI auth, dimensions and restores response order', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ index: 1, embedding: [4, 5, 6] }, { index: 0, embedding: [1, 2, 3] }] }));
    expect(await (await load()).embed(['first', 'second'])).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/embeddings');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-openai-key');
    expect(requestBody()).toEqual({ model: 'text-embedding-3-small', input: ['first', 'second'], encoding_format: 'float', dimensions: 3 });
  });

  it('omits unsupported dimensions for legacy OpenAI models', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('EMBEDDING_MODEL', 'text-embedding-ada-002');
    fetchMock.mockResolvedValue(jsonResponse(indexed([[1, 2, 3]])));
    await (await load()).embed(['code']);
    expect(requestBody()).not.toHaveProperty('dimensions');
  });

  it('supports unauthenticated OpenAI-compatible endpoints and custom models', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai-compatible');
    vi.stubEnv('EMBEDDING_BASE_URL', 'http://localhost:8080/v1/');
    vi.stubEnv('EMBEDDING_MODEL', 'local-model');
    fetchMock.mockResolvedValue(jsonResponse(indexed([[1, 2, 3]])));
    await (await load()).embed(['code']);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/v1/embeddings');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
    expect(requestBody()).not.toHaveProperty('dimensions');
  });

  it('sends separate Voyage document and query input types', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'voyage');
    vi.stubEnv('VOYAGE_API_KEY', 'test-voyage-key');
    fetchMock.mockImplementation(async () => jsonResponse(indexed([[1, 2, 3]])));
    const api = await load();
    await api.embed(['code']);
    await api.embedSingle('question');
    expect(requestBody()).toMatchObject({ model: 'voyage-code-3', input_type: 'document', output_dimension: 3, output_dtype: 'float', truncation: false });
    expect(requestBody(1).input_type).toBe('query');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-voyage-key');
  });

  it('does not request adjustable output for fixed-dimension Voyage models', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'voyage');
    vi.stubEnv('VOYAGE_API_KEY', 'test-key');
    vi.stubEnv('EMBEDDING_MODEL', 'voyage-law-2');
    fetchMock.mockResolvedValue(jsonResponse(indexed([[1, 2, 3]])));
    await (await load()).embed(['code']);
    expect(requestBody()).not.toHaveProperty('output_dimension');
  });

  it('keeps Gemini 2 documents separate and preserves alignment despite response timing', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    fetchMock.mockImplementation(async (_url, init) => {
      const text = JSON.parse(init.body).content.parts[0].text;
      if (text.endsWith('first')) await new Promise(resolve => setTimeout(resolve, 5));
      return jsonResponse({ embedding: { values: text.endsWith('first') ? [1, 2, 3] : [4, 5, 6] } });
    });
    const api = await load();
    expect(await api.embed(['first', 'second'])).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/models/gemini-embedding-2:embedContent');
    expect(fetchMock.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-gemini-key');
    expect(requestBody()).toEqual({ model: 'models/gemini-embedding-2', content: { parts: [{ text: 'title: none | text: first' }] }, outputDimensionality: 3 });
    await api.embedSingle('question');
    expect(requestBody(2).content.parts[0].text).toBe('task: search result | query: question');
    expect(requestBody(2)).not.toHaveProperty('taskType');
  });

  it('supports the Gemini 001 taskType contract and models/ prefix', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'gemini');
    vi.stubEnv('GOOGLE_API_KEY', 'test-google-key');
    vi.stubEnv('EMBEDDING_MODEL', 'models/gemini-embedding-001');
    fetchMock.mockImplementation(async () => jsonResponse({ embedding: { values: [1, 2, 3] } }));
    const api = await load();
    await api.embed(['code']);
    await api.embedSingle('question');
    expect(requestBody().taskType).toBe('RETRIEVAL_DOCUMENT');
    expect(requestBody().content.parts[0].text).toBe('code');
    expect(requestBody(1).taskType).toBe('RETRIEVAL_QUERY');
  });

  it('batches without losing row ordering and skips empty input', async () => {
    vi.stubEnv('EMBEDDING_BATCH_SIZE', '2');
    fetchMock.mockImplementation(async (_url, init) => jsonResponse({ embeddings: JSON.parse(init.body).input.map((text: string) => [Number(text), 0, 0]) }));
    const api = await load();
    expect(await api.embed([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await api.embed(['1', '2', '3'])).toEqual([[1, 0, 0], [2, 0, 0], [3, 0, 0]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('response and configuration validation', () => {
  it.each([
    [{ embeddings: [] }, 'count'],
    [{ embeddings: [[1, 2]] }, 'dimensions'],
    [{ embeddings: [[1, 'two', 3]] }, 'non-numeric'],
    [{ embeddings: [[1, null, 3]] }, 'non-numeric'],
  ])('rejects malformed vectors %#', async (data, error) => {
    fetchMock.mockResolvedValue(jsonResponse(data));
    await expect((await load()).embed(['code'])).rejects.toThrow(error);
  });

  it.each([
    [{ index: 0, embedding: [1, 2, 3] }, { index: 0, embedding: [4, 5, 6] }],
    [{ index: 2, embedding: [1, 2, 3] }, { index: 0, embedding: [4, 5, 6] }],
    [{ embedding: [1, 2, 3] }, { index: 0, embedding: [4, 5, 6] }],
  ])('rejects bad OpenAI response indices %#', async (...data) => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    fetchMock.mockResolvedValue(jsonResponse({ data }));
    await expect((await load()).embed(['a', 'b'])).rejects.toThrow('indices');
  });

  it.each(['openai', 'voyage', 'gemini'])('requires the selected provider key: %s', async provider => {
    vi.stubEnv('EMBEDDING_PROVIDER', provider);
    await expect((await load()).embed(['code'])).rejects.toThrow('Missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the generic key override rather than another provider key', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'old-key');
    vi.stubEnv('EMBEDDING_API_KEY', 'override-key');
    fetchMock.mockResolvedValue(jsonResponse(indexed([[1, 2, 3]])));
    await (await load()).embed(['code']);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer override-key');
  });

  it('requires explicit model and URL for compatible endpoints', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai-compatible');
    await expect((await load()).embed(['code'])).rejects.toThrow('EMBEDDING_MODEL');
    vi.stubEnv('EMBEDDING_MODEL', 'custom');
    vi.resetModules();
    await expect((await load()).embed(['code'])).rejects.toThrow('EMBEDDING_BASE_URL');
  });

  it('rejects unknown providers at startup', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'unknown');
    await expect(load()).rejects.toThrow('Invalid EMBEDDING_PROVIDER');
  });

  it.each(['0', 'NaN', '3.5', '3oops'])('rejects invalid vector size %s', async dimensions => {
    vi.stubEnv('EMBEDDING_DIMENSIONS', dimensions);
    await expect(load()).rejects.toThrow('EMBEDDING_DIMENSIONS');
  });
});

describe('timeouts, retry and health checks', () => {
  it('retries 429 and 503, honoring Retry-After within a bounded retry budget', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(jsonResponse({}, 503, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(jsonResponse({ embeddings: [[1, 2, 3]] }));
    expect(await (await load()).embed(['code'])).toEqual([[1, 2, 3]]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops after the retry budget is exhausted', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}, 429, { 'Retry-After': '0' }));
    await expect((await load()).embed(['code'])).rejects.toThrow('HTTP 429');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry authentication failures or expose API response text', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'secret-test-key');
    fetchMock.mockResolvedValue(jsonResponse({ error: 'secret-test-key private-source-text' }, 401));
    const api = await load();
    const message = await api.embed(['private-source-text']).catch((error: Error) => error.message);
    expect(message).toContain('HTTP 401');
    expect(message).not.toContain('secret-test-key');
    expect(message).not.toContain('private-source-text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the timeout active during response body parsing', async () => {
    vi.stubEnv('EMBEDDING_TIMEOUT_MS', '10');
    fetchMock.mockImplementation(async (_url, init) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    }));
    await expect((await load()).embed(['code'])).rejects.toThrow('timed out after 10ms');
  });

  it('allows timeout=0 without immediately aborting', async () => {
    vi.stubEnv('EMBEDDING_TIMEOUT_MS', '0');
    fetchMock.mockImplementation(async (_url, init) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(init.signal.aborted).toBe(false);
      return jsonResponse({ embeddings: [[1, 2, 3]] });
    });
    await (await load()).embed(['code']);
  });

  it('shares concurrent cloud health probes and caches success', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'voyage');
    vi.stubEnv('VOYAGE_API_KEY', 'test-key');
    fetchMock.mockResolvedValue(jsonResponse(indexed([[1, 2, 3]])));
    const api = await load();
    expect(await Promise.all([api.healthCheck(), api.healthCheck()])).toEqual([true, true]);
    expect(await api.healthCheck()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('probes Ollama with tags instead of embedding', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ models: [] }));
    expect(await (await load()).healthCheck()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/tags');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('does not contact Ollama for missing cloud credentials', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'gemini');
    expect(await (await load()).healthCheck()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
