import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/sqlite.js', () => ({
  getProject: vi.fn(),
  getProjectStats: vi.fn(),
}));

describe('agentRulesStubTool', () => {
  beforeEach(async () => {
    const sqlite = await import('../src/services/sqlite.js');
    vi.mocked(sqlite.getProject).mockReturnValue({
      projectName: 'demo',
      rootPath: '/tmp/demo',
      fileCount: 2,
      chunkCount: 20,
      lastIndexedAt: '2026-01-01T00:00:00.000Z',
      indexedGitHead: null,
    });
    vi.mocked(sqlite.getProjectStats).mockReturnValue({
      languages: [{ language: 'typescript', fileCount: 2, chunkCount: 20 }],
      totalFiles: 2,
      totalChunks: 20,
      totalLines: 100,
      avgChunksPerFile: 10,
    });
  });

  it('returns markdown with title and stack section', async () => {
    const { agentRulesStubTool } = await import('../src/tools/agent-rules-stub.js');
    const r = await agentRulesStubTool({ project_name: 'demo', format: 'generic' });
    const text = r.content[0].text;
    expect(text).toContain('# Agent rules stub');
    expect(text).toContain('**Project:** demo');
    expect(text).toContain('typescript');
    expect(text).toContain('BANNED');
    expect(text).toContain('search(query');
  });

  it('returns error when project missing', async () => {
    const sqlite = await import('../src/services/sqlite.js');
    vi.mocked(sqlite.getProject).mockReturnValue(null);
    const { agentRulesStubTool } = await import('../src/tools/agent-rules-stub.js');
    const r = await agentRulesStubTool({ project_name: 'nope' });
    expect(r.content[0].text).toMatch(/not found/i);
  });
});
