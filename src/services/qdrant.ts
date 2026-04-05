import { QdrantClient } from '@qdrant/js-client-rest';
import { config, getCollectionName } from '../config.js';

let client: QdrantClient;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: config.qdrantUrl });
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

export async function ensureCollection(projectName: string): Promise<void> {
  const collectionName = getCollectionName(projectName);
  const qdrant = getQdrantClient();

  try {
    await qdrant.getCollection(collectionName);
    // Collection already exists
  } catch {
    // Collection doesn't exist, create it
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
  limit: number
): Promise<Array<{ id: string; score: number }>> {
  const collectionName = getCollectionName(projectName);

  try {
    const results = await getQdrantClient().search(collectionName, {
      vector: queryVector,
      limit,
      with_payload: false,
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
