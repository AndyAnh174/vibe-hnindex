import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runInit, type InitOptions } from '../packages/hnindex-cli/src/init.js';
let temp: string;
beforeEach(() => { temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-cli-graph-')); });
afterEach(() => { fs.rmSync(temp, { recursive: true, force: true }); });
function env(extra: Partial<InitOptions> = {}) {
  return JSON.parse(runInit({ cwd: temp, mcp: 'cursor-project', serverName: 'vibe-hnindex', output: 'mcp.json',
    ollamaUrl: 'http://localhost:11434', ollamaModel: 'bge-m3:567m', qdrantUrl: 'http://localhost:6333', dryRun: false, ...extra }).json).mcpServers['vibe-hnindex'].env;
}
describe('CLI graph and rerank configuration', () => {
  it('binds project configurations to cwd and allows explicit root overrides', () => {
    expect(env().HNINDEX_PROJECT_ROOT).toBe(temp);
    expect(env({ projectRoot: 'nested' }).HNINDEX_PROJECT_ROOT).toBe(path.join(temp, 'nested'));
    expect(env().HNINDEX_PROJECT_ROOT).toBe(temp);
  });
  it('does not pin global configurations implicitly, and preserves explicit binding', () => {
    expect(env({ mcp: 'windsurf' })).not.toHaveProperty('HNINDEX_PROJECT_ROOT');
    env({ mcp: 'windsurf', projectRoot: temp });
    expect(env({ mcp: 'windsurf' }).HNINDEX_PROJECT_ROOT).toBe(temp);
  });
  it('writes explicit false flags and preserves them when omitted', () => {
    env({ codeGraphEnabled: false, astChunking: false });
    expect(env()).toMatchObject({ CODE_GRAPH_ENABLED: 'false', AST_CHUNKING: 'false' });
  });
  it('preserves configured reranker when flags are omitted', () => {
    env({ rerankProvider: 'voyage', rerankModel: 'custom', rerankApiKey: 'test-key' });
    expect(env()).toMatchObject({ RERANK_PROVIDER: 'voyage', RERANK_MODEL: 'custom', RERANK_API_KEY: 'test-key' });
  });
  it('clears stale rerank credentials on provider switch and retains embedding settings', () => {
    env({ rerankProvider: 'http', rerankUrl: 'http://old', rerankModel: 'old', rerankApiKey: 'old', embeddingProvider: 'openai' });
    const updated = env({ rerankProvider: 'voyage' });
    expect(updated).toMatchObject({ RERANK_PROVIDER: 'voyage', EMBEDDING_PROVIDER: 'openai' });
    for (const key of ['RERANK_API_KEY', 'RERANK_URL', 'RERANK_MODEL']) expect(updated).not.toHaveProperty(key);
  });
  it('rejects unsupported providers before writing', () => {
    expect(() => env({ rerankProvider: 'invalid' })).toThrow('Invalid --rerank-provider');
    expect(fs.existsSync(path.join(temp, 'mcp.json'))).toBe(false);
  });
});
