import { QdrantClient } from '@qdrant/js-client-rest';
import { config, getCollectionName } from '../config.js';

let client: QdrantClient;
let cloudConfigWarned = false;

function warnIfCloudUrlWithoutApiKey(): void {
  if (cloudConfigWarned) return;
  const url = config.qdrantUrl.toLowerCase();
  const looksLikeCloud = url.startsWith('https://') && url.includes('qdrant');
  if (looksLikeCloud && !config.qdrantApiKey) {
    cloudConfigWarned = true;
    console.error(
      '[qdrant] QDRANT_URL looks like Qdrant Cloud but QDRANT_API_KEY is unset. Set the API key from your Cloud dashboard or semantic search will fail.'
    );
  }
}

export function getQdrantClient(): QdrantClient {
  if (!client) {
    warnIfCloudUrlWithoutApiKey();
    client = new QdrantClient({
      url: config.qdrantUrl,
      checkCompatibility: false,
      ...(config.qdrantApiKey ? { apiKey: config.qdrantApiKey } : {}),
    });
  }
  return client;
}

export async function healthCheck(): Promise<boolean> {
  try {
    await getQdrantClient().getCollections();
    return true;
  } catch {
    return false;
  }
}

/** Best-effort verify collection exists after indexing (points count if available). */
export async function verifyCollectionReady(projectName: string): Promise<{
  ok: boolean;
  pointsCount?: number;
  error?: string;
}> {
  const collectionName = getCollectionName(projectName);
  try {
    const info = await getQdrantClient().getCollection(collectionName);
    const pc = info.points_count;
    return { ok: true, pointsCount: pc == null ? undefined : pc };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ensureCollection(projectName: string): Promise<void> {
  const collectionName = getCollectionName(projectName);
  const qdrant = getQdrantClient();

  try {
    await qdrant.getCollection(collectionName);
    // Collection already exists
  } catch (error: unknown) {
    // Only create if collection not found (404), re-throw other errors
    const status = (error as { status?: number })?.status;
    if (status && status !== 404) {
      throw error;
    }
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: config.embeddingDimensions,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      on_disk_payload: true,
    });
    console.error(`[qdrant] Created collection: ${collectionName}`);
  }
}

export async function upsertPoints(
  projectName: string,
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>
): Promise<void> {
  if (points.length === 0) return;

  const collectionName = getCollectionName(projectName);
  await getQdrantClient().upsert(collectionName, {
    wait: true,
    points: points.map(p => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload,
    })),
  });
}

export async function searchSimilar(
  projectName: string,
  queryVector: number[],
  limit: number,
  filters?: { language?: string; file_pattern?: string }
): Promise<Array<{ id: string; score: number }>> {
  const collectionName = getCollectionName(projectName);

  try {
    const must: Array<Record<string, unknown>> = [];

    if (filters?.language) {
      must.push({
        key: 'language',
        match: { value: filters.language.toLowerCase() },
      });
    }
    if (filters?.file_pattern) {
      // Convert glob pattern to a prefix match for Qdrant
      // e.g. "src/api/*" → match file_path starting with "src/api/"
      const prefix = filters.file_pattern.replace(/\*.*$/, '');
      if (prefix) {
        must.push({
          key: 'file_path',
          match: { text: prefix },
        });
      }
    }

    const filter = must.length > 0 ? { must } : undefined;

    const results = await getQdrantClient().search(collectionName, {
      vector: queryVector,
      limit,
      with_payload: false,
      ...(filter ? { filter } : {}),
    });

    return results.map(r => ({
      id: r.id as string,
      score: r.score,
    }));
  } catch (error) {
    console.error('[qdrant] Search error:', error);
    return [];
  }
}

export async function deletePoints(projectName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const collectionName = getCollectionName(projectName);
  try {
    await getQdrantClient().delete(collectionName, {
      wait: true,
      points: ids,
    });
  } catch (error) {
    console.error('[qdrant] Delete points error:', error);
  }
}

export async function deleteCollection(projectName: string): Promise<void> {
  const collectionName = getCollectionName(projectName);
  try {
    await getQdrantClient().deleteCollection(collectionName);
    console.error(`[qdrant] Deleted collection: ${collectionName}`);
  } catch (error) {
    console.error('[qdrant] Delete collection error:', error);
  }
}
