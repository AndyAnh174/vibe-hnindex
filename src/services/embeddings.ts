import { config } from '../config.js';

interface EmbedResponse {
  embeddings: number[][];
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += config.embeddingBatchSize) {
    const batch = texts.slice(i, i + config.embeddingBatchSize);

    const response = await fetch(`${config.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: batch,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 404) {
        throw new Error(
          `Embedding model "${config.embeddingModel}" not found. Run: ollama pull ${config.embeddingModel}`
        );
      }
      throw new Error(`Ollama embed failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as EmbedResponse;
    for (const row of data.embeddings) {
      if (row.length !== config.embeddingDimensions) {
        throw new Error(
          `Embedding returned invalid dimensions: expected ${config.embeddingDimensions}, got ${row.length}. Set EMBEDDING_DIMENSIONS to match Ollama output for "${config.embeddingModel}" (and re-index if you changed it).`
        );
      }
    }
    results.push(...data.embeddings);
  }

  return results;
}

export async function embedSingle(text: string): Promise<number[]> {
  const results = await embed([text]);
  if (!results[0] || results[0].length !== config.embeddingDimensions) {
    throw new Error(
      `Embedding returned invalid dimensions: expected ${config.embeddingDimensions}, got ${results[0]?.length ?? 0}`
    );
  }
  return results[0];
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}
