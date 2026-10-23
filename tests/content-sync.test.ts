import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const temporary: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-release-docs-'));
  temporary.push(root);
  const files = ['scripts/sync-site-content.mjs', 'package.json', 'package-lock.json', 'graph-languages.json',
    'packages/hnindex-cli/package.json', 'server.json', '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json', 'src/index.ts', 'docs/changelog.md', 'docs/architecture.md',
    'README.md', 'packages/hnindex-cli/README.md', 'docs/README.md',
    ...['website', 'docs-site'].flatMap(site => ['release', 'architecture'].map(name => `${site}/src/lib/${name}.generated.json`))];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.resolve(file), path.join(root, file));
  }
  // Normalize generated JSON after Git's platform line-ending conversion before introducing drift.
  const prepared = run(root);
  if (prepared.status !== 0) throw new Error(prepared.stderr);
  return root;
}
function run(root: string, check = false) {
  return spawnSync(process.execPath, [path.join(root, 'scripts/sync-site-content.mjs'), ...(check ? ['--check'] : [])], { cwd: root, encoding: 'utf8' });
}
afterEach(() => {
  for (const root of temporary.splice(0)) if (path.basename(root).startsWith('hnindex-release-docs-')) fs.rmSync(root, { recursive: true, force: true });
});

describe('release documentation synchronization', () => {
  it('accepts Git-converted CRLF generated data without reporting version drift', () => {
    const root = fixture();
    for (const site of ['website', 'docs-site']) for (const name of ['release', 'architecture']) {
      const file = path.join(root, site, `src/lib/${name}.generated.json`);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
    }
    const result = run(root, true);
    expect(result.status, result.stderr).toBe(0);
  });
  it.each(['README.md', 'packages/hnindex-cli/README.md', 'docs/README.md'])('rejects a stale current release in %s', file => {
    const root = fixture();
    fs.writeFileSync(path.join(root, file), '# Guide\n<!-- hnindex:release:start -->\nCurrent release: v0.15.2\n<!-- hnindex:release:end -->\n');
    const result = run(root, true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(file);
  });
  it('repairs only release banners and preserves historical release information', () => {
    const root = fixture();
    const oldHistory = fs.readFileSync(path.join(root, 'docs/changelog.md'), 'utf8');
    const file = path.join(root, 'packages/hnindex-cli/README.md');
    fs.writeFileSync(file, '# CLI\n<!-- hnindex:release:start -->\nCurrent release: v0.15.2\n<!-- hnindex:release:end -->\n\nHistory: Codex setup was introduced in v0.15.2.\n');
    const result = run(root);
    expect(result.status, result.stderr).toBe(0);
    const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const updated = fs.readFileSync(file, 'utf8');
    expect(updated).toContain(`Current release: **v${version}**`);
    expect(updated).toContain('History: Codex setup was introduced in v0.15.2.');
    expect(fs.readFileSync(path.join(root, 'docs/changelog.md'), 'utf8')).toBe(oldHistory);
    expect(run(root, true).status).toBe(0);
  });
  it('rejects a stale README architecture diagram', () => {
    const root = fixture();
    const file = path.join(root, 'README.md');
    const body = fs.readFileSync(file, 'utf8');
    const stale = '<!-- hnindex:architecture:start -->\n```mermaid\nflowchart TB\nold[Outdated architecture]\n```\n<!-- hnindex:architecture:end -->';
    fs.writeFileSync(file, body.includes('<!-- hnindex:architecture:start -->')
      ? body.replace(/<!-- hnindex:architecture:start -->[\s\S]*?<!-- hnindex:architecture:end -->/, stale)
      : body + '\n' + stale);
    const result = run(root, true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('README.md');
    expect(run(root).status).toBe(0);
    expect(fs.readFileSync(file, 'utf8')).not.toContain('Outdated architecture');
  });
  it('publishes graph language capabilities from the shared registry to both sites', () => {
    const root = fixture();
    for (const site of ['website', 'docs-site']) {
      const data = JSON.parse(fs.readFileSync(path.join(root, site, 'src/lib/release.generated.json'), 'utf8'));
      expect(data.graphLanguages).toEqual(expect.arrayContaining(['TypeScript', 'Python', 'PHP', 'Go', 'Java', 'C', 'C++', 'C#', 'Rust']));
    }
  });
});
