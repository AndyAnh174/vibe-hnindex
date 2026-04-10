import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/embeddings.js', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  embedSingle: vi.fn().mockResolvedValue(new Array(1024).fill(0)),
}));

vi.mock('../src/services/qdrant.js', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  verifyCollectionReady: vi.fn().mockResolvedValue({ ok: true, pointsCount: 10 }),
}));

vi.mock('../src/services/sqlite.js', () => ({
  getProject: vi.fn(),
  getProjectChunkCount: vi.fn(),
}));

describe('serverDiagnosticsTool', () => {
  beforeEach(async () => {
    const sqlite = await import('../src/services/sqlite.js');
    vi.mocked(sqlite.getProject).mockReturnValue({
      projectName: 'demo',
      rootPath: '/tmp/demo',
      fileCount: 1,
      chunkCount: 10,
      lastIndexedAt: '2026-01-01T00:00:00.000Z',
      indexedGitHead: 'abc1234',
    });
    vi.mocked(sqlite.getProjectChunkCount).mockReturnValue(10);
  });

  it('without project_name reports ollama and qdrant reachable', async () => {
    const { serverDiagnosticsTool } = await import('../src/tools/server-diagnostics.js');
    const r = await serverDiagnosticsTool({});
    const text = r.content[0].text;
    expect(text).toContain('## Ollama');
    expect(text).toContain('**Reachable:** yes');
    expect(text).toContain('## Qdrant');
    expect(text).toContain('**Reachable:** yes');
    expect(text).toContain('## Configuration');
  });

  it('with project_name includes chunk vs qdrant comparison', async () => {
    const { serverDiagnosticsTool } = await import('../src/tools/server-diagnostics.js');
    const r = await serverDiagnosticsTool({ project_name: 'demo' });
    const text = r.content[0].text;
    expect(text).toContain('## Project: demo');
    expect(text).toContain('**SQLite chunks:** 10');
    expect(text).toContain('**Match:** match');
  });
});
