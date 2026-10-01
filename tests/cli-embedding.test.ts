import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInit, type InitOptions } from '../packages/hnindex-cli/src/init.js';

let temp: string;
beforeEach(() => { temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-cli-embedding-')); });
afterEach(() => { fs.rmSync(temp, { recursive: true, force: true }); });
const options = (extra: Partial<InitOptions> = {}): InitOptions => ({ cwd: temp, mcp: 'cursor-project', serverName: 'vibe-hnindex', ollamaUrl: 'http://localhost:11434', ollamaModel: 'bge-m3:567m', qdrantUrl: 'http://localhost:6333', dryRun: false, output: 'mcp.json', ...extra });
const env = (extra: Partial<InitOptions> = {}) => JSON.parse(runInit(options(extra)).json).mcpServers['vibe-hnindex'].env;

describe('CLI embedding setup', () => {
  it('writes provider-specific flags while preserving unrelated MCP entries', () => {
    fs.writeFileSync(path.join(temp, 'mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'other-server' } } }));
    const result = runInit(options({ embeddingProvider: 'openai', embeddingModel: 'text-embedding-3-large', embeddingDimensions: 1024, embeddingApiKey: 'test-key' }));
    const parsed = JSON.parse(result.json);
    expect(parsed.mcpServers.other.command).toBe('other-server');
    expect(parsed.mcpServers['vibe-hnindex'].env).toMatchObject({ EMBEDDING_PROVIDER: 'openai', EMBEDDING_MODEL: 'text-embedding-3-large', EMBEDDING_DIMENSIONS: '1024', EMBEDDING_API_KEY: 'test-key' });
  });

  it('preserves provider settings when init flags are omitted', () => {
    env({ embeddingProvider: 'voyage', embeddingModel: 'voyage-code-3', embeddingDimensions: 512, embeddingApiKey: 'test-key' });
    expect(env()).toMatchObject({ EMBEDDING_PROVIDER: 'voyage', EMBEDDING_MODEL: 'voyage-code-3', EMBEDDING_DIMENSIONS: '512', EMBEDDING_API_KEY: 'test-key' });
  });

  it('clears stale generic credentials, dimensions and endpoint when switching provider', () => {
    env({ embeddingProvider: 'openai', embeddingModel: 'old-model', embeddingDimensions: 1536, embeddingBaseUrl: 'https://old.example/v1', embeddingApiKey: 'old-key' });
    const updated = env({ embeddingProvider: 'gemini' });
    expect(updated.EMBEDDING_PROVIDER).toBe('gemini');
    for (const key of ['EMBEDDING_MODEL', 'EMBEDDING_DIMENSIONS', 'EMBEDDING_BASE_URL', 'EMBEDDING_API_KEY']) expect(updated).not.toHaveProperty(key);
  });

  it('supports compatible API setup without changing the user configuration during dry run', () => {
    const result = runInit(options({ embeddingProvider: 'openai-compatible', embeddingModel: 'local-model', embeddingBaseUrl: 'http://localhost:8080/v1', dryRun: true }));
    expect(JSON.parse(result.json).mcpServers['vibe-hnindex'].env.EMBEDDING_BASE_URL).toBe('http://localhost:8080/v1');
    expect(fs.existsSync(result.filePath)).toBe(false);
  });

  it('rejects unknown providers before writing', () => {
    expect(() => runInit(options({ embeddingProvider: 'invalid' }))).toThrow('Invalid --embedding-provider');
    expect(fs.existsSync(path.join(temp, 'mcp.json'))).toBe(false);
  });
});
