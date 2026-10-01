import { config } from '../config.js';

export type EmbeddingInputType = 'document' | 'query';

export function embeddingUnavailableMessage(): string {
  if (config.embeddingProvider === 'ollama') {
    return `Ollama embedding service unavailable. Check EMBEDDING_BASE_URL / OLLAMA_URL and run: ollama serve && ollama pull ${config.embeddingModel}`;
  }
  return `Embedding provider "${config.embeddingProvider}" unavailable. Check its API key, EMBEDDING_MODEL, EMBEDDING_BASE_URL, quota and network connection.`;
}

function validateConfiguration(): void {
  if (!config.embeddingModel) throw new Error('Set EMBEDDING_MODEL for the selected provider.');
  if (!config.embeddingBaseUrl) throw new Error('Set EMBEDDING_BASE_URL for openai-compatible providers (including the API version, e.g. /v1).');
  let url: URL;
  try { url = new URL(config.embeddingBaseUrl); }
  catch { throw new Error('EMBEDDING_BASE_URL must be a valid HTTP(S) API base URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('EMBEDDING_BASE_URL must be an HTTP(S) base URL without credentials, query or fragment.');
  }
  if (['openai', 'voyage', 'gemini'].includes(config.embeddingProvider) && !config.embeddingApiKey) {
    const keyName = { openai: 'OPENAI_API_KEY', voyage: 'VOYAGE_API_KEY', gemini: 'GEMINI_API_KEY' }[config.embeddingProvider as 'openai' | 'voyage' | 'gemini'];
    throw new Error(`Missing ${keyName} (or EMBEDDING_API_KEY) for ${config.embeddingProvider}.`);
  }
}

async function request(endpoint: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = config.embeddingTimeoutMs > 0
      ? setTimeout(() => controller.abort(), config.embeddingTimeoutMs) : undefined;
    let retryDelay: number | undefined;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.embeddingApiKey) {
        headers[config.embeddingProvider === 'gemini' ? 'x-goog-api-key' : 'Authorization'] =
          config.embeddingProvider === 'gemini' ? config.embeddingApiKey : `Bearer ${config.embeddingApiKey}`;
      }
      const response = await fetch(`${config.embeddingBaseUrl}${endpoint}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        if ((response.status === 429 || response.status >= 500) && attempt < config.embeddingMaxRetries) {
          const retryAfter = response.headers.get('retry-after');
          const seconds = retryAfter ? Number(retryAfter) : NaN;
          const dateDelay = retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
          const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(dateDelay) ? dateDelay : 250 * 2 ** attempt;
          retryDelay = Math.min(10000, Math.max(0, delay));
        } else if (response.status === 404 && config.embeddingProvider === 'ollama') {
          throw new Error(`Embedding model not found. Run: ollama pull ${config.embeddingModel}`);
        } else {
          // Never include provider response bodies: they may echo credentials or source text.
          throw new Error(`${config.embeddingProvider} embedding request failed (HTTP ${response.status}). Check API key, model, quota and dimensions.`);
        }
      } else {
        return await response.json();
      }
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`${config.embeddingProvider} embedding request timed out after ${config.embeddingTimeoutMs}ms.`);
      if (error instanceof TypeError) throw new Error(`${config.embeddingProvider} embedding connection failed. Check EMBEDDING_BASE_URL and network connection.`);
      if (error instanceof SyntaxError) throw new Error(`${config.embeddingProvider} returned invalid embedding JSON.`);
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    if (retryDelay !== undefined) await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
}

function orderedVectors(data: any, count: number): unknown[] {
  if (!Array.isArray(data.data) || data.data.length !== count) throw new Error('Embedding response count does not match input count.');
  const rows: unknown[] = new Array(count);
  const seen = new Set<number>();
  for (const item of data.data) {
    if (!Number.isInteger(item?.index) || item.index < 0 || item.index >= count || seen.has(item.index)) {
      throw new Error('Embedding response contains missing, duplicate or invalid indices.');
    }
    seen.add(item.index);
    rows[item.index] = item.embedding;
  }
  return rows;
}

function validateVectors(rows: unknown, count: number): number[][] {
  if (!Array.isArray(rows) || rows.length !== count) throw new Error('Embedding response count does not match input count.');
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== config.embeddingDimensions) {
      throw new Error(`Embedding returned invalid dimensions: expected ${config.embeddingDimensions}, got ${Array.isArray(row) ? row.length : 0}. Set EMBEDDING_DIMENSIONS to match model output and re-index.`);
    }
    if (row.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error('Embedding response contains non-finite or non-numeric vector values.');
    }
  }
  return rows as number[][];
}

async function embedBatch(texts: string[], inputType: EmbeddingInputType): Promise<number[][]> {
  const model = config.embeddingModel;
  let rows: unknown;
  switch (config.embeddingProvider) {
    case 'ollama':
      rows = (await request('/api/embed', { model, input: texts })).embeddings;
      break;
    case 'openai':
    case 'openai-compatible': {
      const data = await request('/embeddings', {
        model, input: texts, encoding_format: 'float',
        // Legacy OpenAI models and arbitrary compatible endpoints may reject dimensions.
        ...(model.startsWith('text-embedding-3') ? { dimensions: config.embeddingDimensions } : {}),
      });
      rows = orderedVectors(data, texts.length);
      break;
    }
    case 'voyage': {
      const adjustable = /^(voyage-4(?:-large|-lite)?|voyage-3-large|voyage-3\.5(?:-lite)?|voyage-code-3)$/.test(model);
      const data = await request('/embeddings', {
        model, input: texts, input_type: inputType, output_dtype: 'float', truncation: false,
        ...(adjustable ? { output_dimension: config.embeddingDimensions } : {}),
      });
      rows = orderedVectors(data, texts.length);
      break;
    }
    case 'gemini': {
      // Gemini Embedding 2 aggregates multiple parts: one request per text preserves chunk alignment.
      const vectors: unknown[] = new Array(texts.length);
      let next = 0;
      let failed = false;
      const settled = await Promise.allSettled(Array.from({ length: Math.min(4, texts.length) }, async () => {
        while (!failed && next < texts.length) {
          const index = next++;
          const legacy = model === 'gemini-embedding-001';
          const text = legacy ? texts[index] : inputType === 'query'
            ? `task: search result | query: ${texts[index]}` : `title: none | text: ${texts[index]}`;
          let data: any;
          try { data = await request(`/models/${encodeURIComponent(model)}:embedContent`, {
            model: `models/${model}`,
            content: { parts: [{ text }] },
            outputDimensionality: config.embeddingDimensions,
            ...(legacy ? { taskType: inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT' } : {}),
          }); } catch (error) { failed = true; throw error; }
          vectors[index] = data.embedding?.values;
        }
      }));
      const failure = settled.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      rows = vectors;
      break;
    }
  }
  return validateVectors(rows, texts.length);
}

export async function embed(texts: string[], inputType: EmbeddingInputType = 'document'): Promise<number[][]> {
  if (texts.length === 0) return [];
  validateConfiguration();
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += config.embeddingBatchSize) {
    results.push(...await embedBatch(texts.slice(i, i + config.embeddingBatchSize), inputType));
  }
  return results;
}

export async function embedSingle(text: string): Promise<number[]> {
  return (await embed([text], 'query'))[0];
}

let healthResult: { ok: boolean; expires: number } | undefined;
let healthPending: Promise<boolean> | undefined;

export async function healthCheck(): Promise<boolean> {
  if (healthResult && healthResult.expires > Date.now()) return healthResult.ok;
  if (healthPending) return healthPending;
  healthPending = (async () => {
    let ok = false;
    try {
      validateConfiguration();
      if (config.embeddingProvider === 'ollama') await request('/api/tags');
      else await embedSingle('health check');
      ok = true;
    } catch { /* caller reports provider-specific troubleshooting */ }
    healthResult = { ok, expires: Date.now() + (ok ? 30000 : 5000) };
    return ok;
  })();
  try { return await healthPending; } finally { healthPending = undefined; }
}
