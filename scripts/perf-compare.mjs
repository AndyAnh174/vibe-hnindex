#!/usr/bin/env node
/**
 * So sánh hiệu năng: ripgrep (baseline full-text disk) vs vibe-hnindex search (keyword/semantic/hybrid).
 * Chạy từ root repo: node scripts/perf-compare.mjs
 * Env: giống MCP (OLLAMA_URL, OLLAMA_MODEL, QDRANT_URL, …)
 */
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function loadSearch() {
  const { initDatabase } = await import('../dist/services/sqlite.js');
  const { search } = await import('../dist/tools/search.js');
  initDatabase();
  return search;
}

function statsMs(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const avg = sum / s.length;
  const min = s[0];
  const max = s[s.length - 1];
  const p50 = s[Math.floor(s.length / 2)];
  return { n: s.length, min, max, avg, p50 };
}

function benchRipgrep(query, cwd) {
  const rgArgs = ['-l', query, '.', '--glob', '!node_modules', '--glob', '!dist', '--glob', '!.git'];
  const t0 = performance.now();
  const r = spawnSync('rg', rgArgs, { cwd, encoding: 'utf8' });
  const t1 = performance.now();
  if (!r.error && (r.status === 0 || r.status === 1)) {
    const lines = (r.stdout || '').trim().split('\n').filter(Boolean);
    return { ok: true, tool: 'rg', ms: t1 - t0, fileCount: lines.length };
  }
  if (r.error?.code !== 'ENOENT') {
    return {
      ok: false,
      ms: t1 - t0,
      note: `rg lỗi (exit ${r.status}): ${(r.stderr || String(r.error)).slice(0, 200)}`,
    };
  }
  const g0 = performance.now();
  const g = spawnSync(
    'git',
    ['grep', '-l', query, '--', '*.ts', '*.tsx', '*.js', '*.md', '*.mdx'],
    { cwd, encoding: 'utf8' },
  );
  const g1 = performance.now();
  if (g.error?.code === 'ENOENT') {
    return { ok: false, ms: null, note: 'rg không có trong PATH và git không chạy được' };
  }
  if (g.status !== 0 && g.status !== 1) {
    return { ok: false, ms: g1 - g0, note: `git grep exit ${g.status}` };
  }
  const gLines = (g.stdout || '').trim().split('\n').filter(Boolean);
  return { ok: true, tool: 'git grep', ms: g1 - g0, fileCount: gLines.length };
}

async function benchSearch(search, args, rounds, warmup = 1) {
  const times = [];
  for (let i = 0; i < warmup; i++) {
    await search({ ...args, limit: 10 });
  }
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    await search({ ...args, limit: 10 });
    times.push(performance.now() - t0);
  }
  return statsMs(times);
}

const PROJECT = process.env.BENCH_PROJECT || 'hnindex-mcp';
const QUERY = process.env.BENCH_QUERY || 'index_codebase watch embedding';
const ROUNDS = Math.max(3, parseInt(process.env.BENCH_ROUNDS || '8', 10));

const search = await loadSearch();

console.log('=== vibe-hnindex perf compare ===');
console.log(`Project: ${PROJECT}`);
console.log(`Query:   ${QUERY}`);
console.log(`Rounds:  ${ROUNDS} (sau warmup 1)`);
console.log(`Root:    ${root}\n`);

const rg = benchRipgrep('index_codebase', root);

const keyword = await benchSearch(
  search,
  { query: QUERY, project_name: PROJECT, mode: 'keyword', rerank: false },
  ROUNDS,
);
const semantic = await benchSearch(
  search,
  { query: QUERY, project_name: PROJECT, mode: 'semantic', rerank: false },
  ROUNDS,
);
const hybrid = await benchSearch(
  search,
  { query: QUERY, project_name: PROJECT, mode: 'hybrid', rerank: false },
  ROUNDS,
);

const table = {
  disk_grep_baseline: rg.ok
    ? { tool: rg.tool, ms_one_shot: rg.ms.toFixed(2), files_matched: rg.fileCount }
    : { error: rg.note },
  hnindex_keyword: {
    ms_min: keyword.min.toFixed(2),
    ms_p50: keyword.p50.toFixed(2),
    ms_avg: keyword.avg.toFixed(2),
    ms_max: keyword.max.toFixed(2),
  },
  hnindex_semantic: {
    ms_min: semantic.min.toFixed(2),
    ms_p50: semantic.p50.toFixed(2),
    ms_avg: semantic.avg.toFixed(2),
    ms_max: semantic.max.toFixed(2),
  },
  hnindex_hybrid: {
    ms_min: hybrid.min.toFixed(2),
    ms_p50: hybrid.p50.toFixed(2),
    ms_avg: hybrid.avg.toFixed(2),
    ms_max: hybrid.max.toFixed(2),
  },
};

console.log(JSON.stringify(table, null, 2));
