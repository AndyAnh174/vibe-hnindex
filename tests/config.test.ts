import { describe, it, expect, vi, afterEach } from 'vitest';

describe('config', () => {
  afterEach(() => {
    delete process.env.EMBEDDING_DIMENSIONS;
    vi.resetModules();
  });

  it('should have default values', async () => {
    vi.resetModules();
    const { config } = await import('../src/config.js');
    expect(config.embeddingDimensions).toBe(1024);
    expect(config.chunkSize).toBe(60);
    expect(config.chunkOverlap).toBe(5);
    expect(config.maxFileSize).toBe(1048576);
    expect(config.embeddingBatchSize).toBe(32);
  });

  it('should have valid qdrant collection prefix', async () => {
    vi.resetModules();
    const { config } = await import('../src/config.js');
    expect(config.qdrantCollectionPrefix).toBe('mcp_ck_');
  });

  it('should read EMBEDDING_DIMENSIONS from env', async () => {
    process.env.EMBEDDING_DIMENSIONS = '768';
    vi.resetModules();
    const { config } = await import('../src/config.js');
    expect(config.embeddingDimensions).toBe(768);
  });
});

describe('getCollectionName', () => {
  it('should prefix with collection prefix', async () => {
    vi.resetModules();
    const { getCollectionName } = await import('../src/config.js');
    expect(getCollectionName('my-app')).toBe('mcp_ck_my_app');
  });

  it('should sanitize special characters', async () => {
    vi.resetModules();
    const { getCollectionName } = await import('../src/config.js');
    expect(getCollectionName('my app/v2')).toBe('mcp_ck_my_app_v2');
    expect(getCollectionName('project@2.0')).toBe('mcp_ck_project_2_0');
  });

  it('should keep alphanumeric and underscores', async () => {
    vi.resetModules();
    const { getCollectionName } = await import('../src/config.js');
    expect(getCollectionName('my_project_123')).toBe('mcp_ck_my_project_123');
  });
});
