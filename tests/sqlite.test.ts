import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Override storage path BEFORE importing sqlite
const testDir = path.join(os.tmpdir(), `vibe-hnindex-test-${Date.now()}`);
process.env.STORAGE_PATH = testDir;

// Dynamic import after env is set
const sqlite = await import('../src/services/sqlite.js');

describe('sqlite', () => {
  beforeAll(() => {
    sqlite.initDatabase();
  });

  afterAll(() => {
    // Cleanup
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('projects', () => {
    it('should create and retrieve a project', () => {
      sqlite.upsertProject('test-project', '/tmp/test');
      const projects = sqlite.listProjects();
      expect(projects.length).toBeGreaterThanOrEqual(1);

      const p = projects.find(p => p.projectName === 'test-project');
      expect(p).toBeDefined();
      expect(p!.rootPath).toBe('/tmp/test');
    });

    it('should update project on upsert', () => {
      sqlite.upsertProject('test-project', '/tmp/test-updated');
      const p = sqlite.getProject('test-project');
      expect(p).not.toBeNull();
      expect(p!.rootPath).toBe('/tmp/test-updated');
    });

    it('should return null for non-existent project', () => {
      expect(sqlite.getProject('nonexistent')).toBeNull();
    });
  });

  describe('chunks', () => {
    it('should insert and retrieve chunks', () => {
      sqlite.insertChunks([
        {
          id: 'chunk-1',
          projectName: 'test-project',
          filePath: 'src/index.ts',
          absolutePath: '/tmp/test/src/index.ts',
          chunkIndex: 0,
          startLine: 1,
          endLine: 30,
          content: 'function hello() { return "world"; }',
          language: 'typescript',
          fileHash: 'abc123',
          indexedAt: new Date().toISOString(),
        },
        {
          id: 'chunk-2',
          projectName: 'test-project',
          filePath: 'src/index.ts',
          absolutePath: '/tmp/test/src/index.ts',
          chunkIndex: 1,
          startLine: 28,
          endLine: 60,
          content: 'function goodbye() { return "farewell"; }',
          language: 'typescript',
          fileHash: 'abc123',
          indexedAt: new Date().toISOString(),
        },
      ]);

      const chunks = sqlite.getFileChunks('test-project', 'src/index.ts');
      expect(chunks).toHaveLength(2);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[1].chunkIndex).toBe(1);
    });

    it('should get chunks by IDs', () => {
      const chunks = sqlite.getChunksByIds(['chunk-1', 'chunk-2']);
      expect(chunks).toHaveLength(2);
    });

    it('should return empty for nonexistent IDs', () => {
      const chunks = sqlite.getChunksByIds(['nonexistent-id']);
      expect(chunks).toHaveLength(0);
    });

    it('should get existing file hash', () => {
      const hash = sqlite.getExistingFileHash('test-project', 'src/index.ts');
      expect(hash).toBe('abc123');
    });

    it('should return null hash for non-indexed file', () => {
      const hash = sqlite.getExistingFileHash('test-project', 'src/unknown.ts');
      expect(hash).toBeNull();
    });

    it('should delete file chunks and return IDs', () => {
      const ids = sqlite.deleteFileChunks('test-project', 'src/index.ts');
      expect(ids).toHaveLength(2);
      expect(ids).toContain('chunk-1');
      expect(ids).toContain('chunk-2');

      const remaining = sqlite.getFileChunks('test-project', 'src/index.ts');
      expect(remaining).toHaveLength(0);
    });
  });

  describe('keyword search', () => {
    beforeAll(() => {
      sqlite.insertChunks([
        {
          id: 'search-1',
          projectName: 'test-project',
          filePath: 'src/auth.ts',
          absolutePath: '/tmp/test/src/auth.ts',
          chunkIndex: 0,
          startLine: 1,
          endLine: 30,
          content: 'function authenticateUser(token: string) { validateJWT(token); }',
          language: 'typescript',
          fileHash: 'def456',
          indexedAt: new Date().toISOString(),
        },
        {
          id: 'search-2',
          projectName: 'test-project',
          filePath: 'src/api/payment.ts',
          absolutePath: '/tmp/test/src/api/payment.ts',
          chunkIndex: 0,
          startLine: 1,
          endLine: 20,
          content: 'async function processPayment(amount: number) { charge(amount); }',
          language: 'typescript',
          fileHash: 'ghi789',
          indexedAt: new Date().toISOString(),
        },
        {
          id: 'search-3',
          projectName: 'test-project',
          filePath: 'src/utils.py',
          absolutePath: '/tmp/test/src/utils.py',
          chunkIndex: 0,
          startLine: 1,
          endLine: 15,
          content: 'def authenticate_request(req): verify_token(req.headers)',
          language: 'python',
          fileHash: 'jkl012',
          indexedAt: new Date().toISOString(),
        },
      ]);
    });

    it('should find results by keyword', () => {
      const results = sqlite.searchKeyword('authenticateUser', 'test-project', 10);
      expect(results.length).toBeGreaterThanOrEqual(1);
      const authResult = results.find(r => r.content.includes('authenticateUser'));
      expect(authResult).toBeDefined();
    });

    it('should return empty for no matches', () => {
      const results = sqlite.searchKeyword('zzzznonexistent', 'test-project', 10);
      expect(results).toHaveLength(0);
    });

    it('should filter by language', () => {
      const results = sqlite.searchKeyword('authenticate', 'test-project', 10, {
        language: 'python',
      });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every(r => r.language === 'python')).toBe(true);
    });

    it('should filter by file pattern', () => {
      const results = sqlite.searchKeyword('processPayment', 'test-project', 10, {
        file_pattern: 'src/api/*',
      });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every(r => r.filePath.startsWith('src/api/'))).toBe(true);
    });

    it('should return empty when filters exclude all results', () => {
      const results = sqlite.searchKeyword('authenticate', 'test-project', 10, {
        language: 'go',
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('project stats', () => {
    it('should return language breakdown', () => {
      const stats = sqlite.getProjectStats('test-project');
      expect(stats.totalFiles).toBeGreaterThanOrEqual(2);
      expect(stats.totalChunks).toBeGreaterThanOrEqual(3);
      expect(stats.languages.length).toBeGreaterThanOrEqual(2);

      const ts = stats.languages.find(l => l.language === 'typescript');
      expect(ts).toBeDefined();
      expect(ts!.fileCount).toBeGreaterThanOrEqual(1);
    });

    it('should return zero stats for nonexistent project', () => {
      const stats = sqlite.getProjectStats('nonexistent');
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalChunks).toBe(0);
      expect(stats.languages).toHaveLength(0);
    });
  });

  describe('adjacent chunks', () => {
    beforeAll(() => {
      sqlite.insertChunks([
        {
          id: 'adj-0', projectName: 'test-project', filePath: 'src/big.ts',
          absolutePath: '/tmp/test/src/big.ts', chunkIndex: 0,
          startLine: 1, endLine: 30, content: 'chunk 0 content',
          language: 'typescript', fileHash: 'adj-hash', indexedAt: new Date().toISOString(),
        },
        {
          id: 'adj-1', projectName: 'test-project', filePath: 'src/big.ts',
          absolutePath: '/tmp/test/src/big.ts', chunkIndex: 1,
          startLine: 26, endLine: 60, content: 'chunk 1 content',
          language: 'typescript', fileHash: 'adj-hash', indexedAt: new Date().toISOString(),
        },
        {
          id: 'adj-2', projectName: 'test-project', filePath: 'src/big.ts',
          absolutePath: '/tmp/test/src/big.ts', chunkIndex: 2,
          startLine: 56, endLine: 90, content: 'chunk 2 content',
          language: 'typescript', fileHash: 'adj-hash', indexedAt: new Date().toISOString(),
        },
      ]);
    });

    it('should return adjacent chunks for context expansion', () => {
      const results = sqlite.getAdjacentChunks('test-project', 'src/big.ts', 1, 1, 1);
      expect(results).toHaveLength(3);
      expect(results[0].chunkIndex).toBe(0);
      expect(results[1].chunkIndex).toBe(1);
      expect(results[2].chunkIndex).toBe(2);
    });

    it('should handle edge case at start', () => {
      const results = sqlite.getAdjacentChunks('test-project', 'src/big.ts', 0, 2, 0);
      expect(results).toHaveLength(1);
      expect(results[0].chunkIndex).toBe(0);
    });

    it('should handle edge case at end', () => {
      const results = sqlite.getAdjacentChunks('test-project', 'src/big.ts', 2, 0, 2);
      expect(results).toHaveLength(1);
      expect(results[0].chunkIndex).toBe(2);
    });
  });

  describe('delete project', () => {
    it('should delete all project data', () => {
      sqlite.deleteProject('test-project');
      expect(sqlite.getProject('test-project')).toBeNull();
      expect(sqlite.getProjectFileCount('test-project')).toBe(0);
      expect(sqlite.getProjectChunkCount('test-project')).toBe(0);
    });
  });
});
