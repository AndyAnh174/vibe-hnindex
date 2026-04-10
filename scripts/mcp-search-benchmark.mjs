#!/usr/bin/env node
/**
 * Benchmark MCP search theo từng model embedding: index + search (keyword/semantic/hybrid/auto/symbol) + project_stats + symbol_lookup + list_projects.
 *
 * Chạy sau `npm run build`. Cần Ollama + Qdrant đạt (cùng env như MCP).
 *
 * Env:
 *   OLLAMA_URL (vd: http://222.253.80.30:11434)
 *   QDRANT_URL (vd: http://localhost:6333)
 *   QDRANT_API_KEY — nếu Cloud
 *   BENCH_OUT — file JSON output (mặc định: benchmark-results/mcp-search-benchmark.json)
 *   BENCH_MD — file Markdown báo cáo (mặc định: benchmark-results/mcp-search-benchmark.md)
 *
 * Usage:
 *   node scripts/mcp-search-benchmark.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MODELS = [
  { slug: 'nomic', name: 'nomic-embed-text-v2-moe:latest', dim: '768' },
  { slug: 'gemma', name: 'embeddinggemma:300m', dim: '768' },
  { slug: 'bge', name: 'bge-m3:567m', dim: '1024' },
];

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const TMP_BASE =
  process.env.BENCH_STORAGE_BASE || path.join(os.tmpdir(), 'vibe-hnindex-mcp-bench');

function runWorker(model) {
  const storagePath = path.join(TMP_BASE, model.slug);
  const env = {
    ...process.env,
    OLLAMA_URL,
    OLLAMA_MODEL: model.name,
    EMBEDDING_DIMENSIONS: model.dim,
    QDRANT_URL,
    SEARCH_AUTO_ROUTE: 'true',
    SEARCH_KEYWORD_FALLBACK_SEMANTIC: 'true',
    SEARCH_RERANK: 'false',
    STORAGE_PATH: storagePath,
    BENCH_MODEL_SLUG: model.slug,
    BENCH_PROJECT_NAME: `mcpbench_${model.slug}`,
    BENCH_FIXTURE_PATH: path.join(root, 'benchmark-fixture'),
    NODE_NO_WARNINGS: '1',
  };
  if (process.env.QDRANT_API_KEY) {
    env.QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  }

  const r = spawnSync(process.execPath, [path.join(__dirname, 'benchmark-model-worker.mjs')], {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 600000,
  });

  const out = (r.stdout || '').trim();
  const err = (r.stderr || '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(out.split('\n').filter(Boolean).pop() || '{}');
  } catch {
    parsed = { parseError: true, raw: out.slice(0, 500), stderr: err.slice(0, 500) };
  }
  return {
    status: r.status,
    signal: r.signal,
    stderr: err,
    report: parsed,
  };
}

function mdTable(rows) {
  if (!rows || rows.length === 0) {
    return '_Không có dữ liệu._';
  }
  const headers = Object.keys(rows[0]);
  const sep = headers.map(() => '---');
  const lines = [
    '| ' + headers.join(' | ') + ' |',
    '| ' + sep.join(' | ') + ' |',
    ...rows.map((row) => '| ' + headers.map((h) => String(row[h] ?? '')).join(' | ') + ' |'),
  ];
  return lines.join('\n');
}

function main() {
  const outDir = path.join(root, 'benchmark-results');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = process.env.BENCH_OUT || path.join(outDir, 'mcp-search-benchmark.json');
  const mdPath = process.env.BENCH_MD || path.join(outDir, 'mcp-search-benchmark.md');

  console.error('=== MCP search benchmark (vibe-hnindex tools) ===');
  console.error(`OLLAMA_URL=${OLLAMA_URL}`);
  console.error(`QDRANT_URL=${QDRANT_URL}`);
  console.error(`STORAGE (per model): ${TMP_BASE}/<slug>\n`);

  const all = [];
  for (const m of MODELS) {
    console.error(`→ Model ${m.name} (${m.dim}d) …`);
    const r = runWorker(m);
    all.push({ model: m.name, slug: m.slug, dim: m.dim, ...r });
    if (r.status !== 0) {
      console.error(`  exit ${r.status}`, r.report?.error || r.report?.fatal || '');
    } else {
      console.error(`  index ${r.report?.index?.ms}ms, chunks=${r.report?.index?.totalChunks}`);
    }
  }

  const flat = [];
  for (const run of all) {
    const rep = run.report;
    if (!rep || rep.fatal || rep.parseError) {
      flat.push({
        model: run.model,
        tool: '—',
        ms: '—',
        ok: false,
        note: rep?.error || rep?.stderr?.slice(0, 80) || 'failed',
      });
      continue;
    }
    flat.push({
      model: run.model,
      tool: 'index_codebase',
      ms: rep.index?.ms,
      ok: rep.index?.ok,
      note: `chunks=${rep.index?.totalChunks ?? '?'} qdrant=${rep.index?.qdrantVectors ?? '?'}`,
    });
    for (const t of rep.tools || []) {
      flat.push({
        model: run.model,
        tool: t.name,
        ms: t.ms,
        ok: t.ok,
        note: t.error || (t.preview ? t.preview.slice(0, 60) : ''),
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    ollamaUrl: OLLAMA_URL,
    qdrantUrl: QDRANT_URL,
    runs: all.map((x) => ({
      model: x.model,
      slug: x.slug,
      dim: x.dim,
      status: x.status,
      report: x.report,
    })),
    flatTable: flat,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  const byModel = new Map();
  for (const row of flat) {
    if (!byModel.has(row.model)) byModel.set(row.model, []);
    byModel.get(row.model).push(row);
  }
  const summaryRows = [];
  for (const [model, rows] of byModel) {
    const idx = rows.find((r) => r.tool === 'index_codebase');
    const searchTools = [
      'search_keyword',
      'search_semantic',
      'search_hybrid',
      'search_auto',
      'search_symbol',
    ];
    let searchSum = 0;
    let searchN = 0;
    for (const name of searchTools) {
      const t = rows.find((r) => r.tool === name);
      if (t && typeof t.ms === 'number') {
        searchSum += t.ms;
        searchN++;
      }
    }
    const other = rows.filter((r) =>
      ['project_stats', 'symbol_lookup', 'list_projects'].includes(r.tool),
    );
    let otherSum = 0;
    for (const t of other) {
      if (typeof t.ms === 'number') otherSum += t.ms;
    }
    summaryRows.push({
      Model: model,
      index_ms: idx?.ms ?? '—',
      search_5modes_sum_ms: searchN ? Math.round(searchSum * 100) / 100 : '—',
      other_tools_sum_ms: Math.round(otherSum * 100) / 100,
    });
  }

  const md = [
    '# MCP search benchmark — vibe-hnindex',
    '',
    `- **Thời gian:** ${summary.generatedAt}`,
    `- **Ollama:** \`${OLLAMA_URL}\``,
    `- **Qdrant:** \`${QDRANT_URL}\``,
    `- **Fixture:** \`benchmark-fixture/\` (index mỗi model vào project \`mcpbench_<slug>\`, SQLite riêng dưới \`${TMP_BASE}\`)`,
    '',
    '## Tổng hợp theo model',
    '',
    mdTable(summaryRows),
    '',
    '- **search_5modes_sum_ms**: tổng thời gian 5 lần gọi `search` (keyword + semantic + hybrid + auto + symbol).',
    '- **other_tools_sum_ms**: `project_stats` + `symbol_lookup` + `list_projects`.',
    '',
    '## Chi tiết từng tool (ms) và trạng thái',
    '',
    mdTable(
      flat.map((r) => ({
        Model: r.model,
        Tool: r.tool,
        'ms': r.ms,
        OK: r.ok,
        Ghi_chú: r.note,
      })),
    ),
    '',
    '## Ghi chú',
    '',
    '- **search_***: cùng query ngữ nghĩa / keyword / symbol như trong `benchmark-model-worker.mjs`.',
    '- **index_codebase**: gồm embed toàn bộ fixture; ms phụ thuộc model + mạng tới Ollama.',
    '- **ok**: `false` nếu tool trả text bắt đầu bằng `Error:` hoặc throw.',
    '- JSON đầy đủ: `benchmark-results/mcp-search-benchmark.json`',
    '',
  ].join('\n');

  fs.writeFileSync(mdPath, md, 'utf8');

  console.error(`\nWrote: ${jsonPath}`);
  console.error(`Wrote: ${mdPath}`);
  console.log(md);
}

main();
