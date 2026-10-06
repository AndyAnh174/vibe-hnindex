import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse, stringify } from 'smol-toml';
import { runInit, type InitOptions } from '../packages/hnindex-cli/src/init.js';
import { parseTarget, resolveTargetPath } from '../packages/hnindex-cli/src/paths.js';
import { runInitSkill } from '../packages/hnindex-cli/src/init-skill.js';

let temp: string;
beforeEach(() => { temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-codex-')); });
afterEach(() => { fs.rmSync(temp, { recursive: true, force: true }); });
function init(extra: Partial<InitOptions> = {}) {
  return runInit({ cwd: temp, mcp: 'codex', serverName: 'vibe-hnindex',
    ollamaUrl: 'http://localhost:11434', ollamaModel: 'bge-m3:567m',
    qdrantUrl: 'http://localhost:6333', dryRun: false, ...extra });
}
function seed(config: Record<string, unknown>) {
  const file = path.join(temp, '.codex', 'config.toml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stringify(config));
  return file;
}
function server(text: string, name = 'vibe-hnindex') {
  return (parse(text).mcp_servers as Record<string, any>)[name];
}

describe('Codex project MCP configuration', () => {
  it('creates parseable TOML with stdio and an absolute workspace binding', () => {
    expect(parseTarget('Codex')).toBe('codex');
    const result = init();
    expect(result.filePath).toBe(resolveTargetPath('codex', temp).filePath);
    expect(server(result.json)).toMatchObject({ command: 'npx', args: ['-y', 'vibe-hnindex'],
      env: { HNINDEX_PROJECT_ROOT: temp } });
    expect(fs.readFileSync(result.filePath, 'utf8')).toBe(result.json);
  });
  it('preserves model, approval settings, other servers and existing hnindex policies', () => {
    const original = { model: 'custom-model', approval_policy: 'on-request', sandbox_mode: 'workspace-write',
      projects: { [temp]: { trust_level: 'trusted' } },
      mcp_servers: { docs: { url: 'https://example.com/mcp', enabled: false },
        'vibe-hnindex': { command: 'old', startup_timeout_sec: 30,
          disabled_tools: ['code_apply'], env: { EMBEDDING_PROVIDER: 'openai', EMBEDDING_API_KEY: 'test-only', EMBEDDING_DIMENSIONS: '1536' } } } };
    seed(original);
    const parsed = parse(init().json);
    for (const key of ['model', 'approval_policy', 'sandbox_mode', 'projects']) expect(parsed[key]).toEqual((original as any)[key]);
    expect((parsed.mcp_servers as any).docs).toEqual(original.mcp_servers.docs);
    expect((parsed.mcp_servers as any)['vibe-hnindex']).toMatchObject({ startup_timeout_sec: 30,
      disabled_tools: ['code_apply'], env: original.mcp_servers['vibe-hnindex'].env });
  });
  it('clears stale generic embedding credentials when switching providers', () => {
    init({ embeddingProvider: 'openai', embeddingApiKey: 'test-only', embeddingModel: 'old', embeddingDimensions: 1536 });
    const updated = server(init({ embeddingProvider: 'voyage' }).json).env;
    expect(updated.EMBEDDING_PROVIDER).toBe('voyage');
    for (const key of ['EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_DIMENSIONS']) expect(updated).not.toHaveProperty(key);
  });
  it('supports explicit roots, output paths, and quoted server names', () => {
    const result = init({ projectRoot: 'nested', output: 'custom/config.toml', serverName: 'custom.name' });
    expect(result.filePath).toBe(path.join(temp, 'custom', 'config.toml'));
    expect(server(result.json, 'custom.name').env.HNINDEX_PROJECT_ROOT).toBe(path.join(temp, 'nested'));
  });
  it('dry runs without creating files or changing an existing configuration', () => {
    const result = init({ dryRun: true });
    expect(result.written).toBe(false);
    expect(fs.existsSync(result.filePath)).toBe(false);
    const file = seed({ model: 'keep-me' });
    const before = fs.readFileSync(file, 'utf8');
    init({ dryRun: true });
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
  it('serializes a server name that matches a JavaScript prototype key', () => {
    const result = init({ serverName: '__proto__' });
    expect(server(result.json, '__proto__').command).toBe('npx');
    expect(Object.prototype).not.toHaveProperty('command');
  });
  it('rejects invalid TOML, malformed tables and HTTP name collisions without writing', () => {
    const file = seed({});
    for (const invalid of ['model = "unterminated', 'mcp_servers = "wrong"',
      stringify({ mcp_servers: { 'vibe-hnindex': { url: 'https://example.com/mcp' } } })]) {
      fs.writeFileSync(file, invalid);
      expect(() => init()).toThrow();
      expect(fs.readFileSync(file, 'utf8')).toBe(invalid);
    }
  });
  it('is idempotent when re-run without flags', () => {
    const first = init();
    expect(init().json).toBe(first.json);
  });
  it('installs the skill in the Codex repository discovery directory', () => {
    const result = runInitSkill('codex', temp);
    expect(result.filePath).toBe(path.join(temp, '.agents', 'skills', 'use-vibe-hnindex', 'SKILL.md'));
    expect(fs.readFileSync(result.filePath, 'utf8')).toContain('workspace_context');
  });
});
