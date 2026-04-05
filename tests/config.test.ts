import { describe, it, expect } from 'vitest';
import { config, getCollectionName } from '../src/config.js';

describe('config', () => {
  it('should have default values', () => {
    expect(config.embeddingDimensions).toBe(1024);
    expect(config.chunkSize).toBe(60);
    expect(config.chunkOverlap).toBe(5);
    expect(config.maxFileSize).toBe(1048576);
    expect(config.embeddingBatchSize).toBe(32);
  });

  it('should have valid qdrant collection prefix', () => {
    expect(config.qdrantCollectionPrefix).toBe('mcp_ck_');
  });
});

describe('getCollectionName', () => {
  it('should prefix with collection prefix', () => {
    expect(getCollectionName('my-app')).toBe('mcp_ck_my_app');
  });

  it('should sanitize special characters', () => {
    expect(getCollectionName('my app/v2')).toBe('mcp_ck_my_app_v2');
    expect(getCollectionName('project@2.0')).toBe('mcp_ck_project_2_0');
  });

  it('should keep alphanumeric and underscores', () => {
    expect(getCollectionName('my_project_123')).toBe('mcp_ck_my_project_123');
  });
});
