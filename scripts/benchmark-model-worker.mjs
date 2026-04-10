#!/usr/bin/env node
/**
 * Một process / một model: env (OLLAMA_*, EMBEDDING_DIMENSIONS, STORAGE_PATH, …) phải set sẵn trước khi spawn.
 * In JSON một dòng ra stdout (stderr: log lib).
 */
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MODEL_SLUG = process.env.BENCH_MODEL_SLUG || 'model';
const PROJECT = process.env.BENCH_PROJECT_NAME || `mcpbench_${MODEL_SLUG}`;
const FIXTURE = process.env.BENCH_FIXTURE_PATH || path.join(root, 'benchmark-fixture');

const SEARCH_QUERY = process.env.BENCH_SEARCH_QUERY || 'Qdrant Ollama embedding hybrid search pipeline';
const KEYWORD_QUERY = process.env.BENCH_KEYWORD_QUERY || 'parseEmbeddingDimensions';
const SYMBOL_QUERY = process.env.BENCH_SYMBOL_QUERY || 'parseEmbeddingDimensions';

function textOf(r) {
  return r?.content?.map((c) => c.text).join('\n') ?? '';
}

function isErr(t) {
  return typeof t === 'string' && t.trimStart().startsWith('Error:');
}

async function timed(name, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = Math.round((performance.now() - t0) * 100) / 100;
    const txt = textOf(result);
    return {
      name,
      ms,
      ok: !isErr(txt),
      textLen: txt.length,
      preview: txt.slice(0, 200).replace(/\s+/g, ' '),
    };
  } catch (e) {
    const ms = Math.round((performance.now() - t0) * 100) / 100;
    return {
      name,
      ms,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  const { initDatabase } = await import('../dist/services/sqlite.js');
  const { deleteProjectTool } = await import('../dist/tools/delete-project.js');
  const { indexCodebase } = await import('../dist/tools/index-codebase.js');
  const { search } = await import('../dist/tools/search.js');
  const { projectStatsTool } = await import('../dist/tools/project-stats.js');
  const { symbolLookupTool } = await import('../dist/tools/symbol-lookup.js');
  const { listProjectsTool } = await import('../dist/tools/list-projects.js');

  initDatabase();

  await deleteProjectTool({ project_name: PROJECT });

  const indexT0 = performance.now();
  const indexRes = await indexCodebase({
    path: FIXTURE,
    project_name: PROJECT,
    watch: false,
  });
  const indexMs = Math.round((performance.now() - indexT0) * 100) / 100;
  const indexText = textOf(indexRes);
  const indexOk = !isErr(indexText);
  const chunksM = indexText.match(/Total chunks:\s*(\d+)/);
  const qvM = indexText.match(/qdrant_vectors:\s*(\d+)/);
  const readyM = indexText.match(/Ready:\s*(yes|no)/);

  const common = {
    query: SEARCH_QUERY,
    project_name: PROJECT,
    limit: 10,
    rerank: false,
  };

  const runs = [];
  runs.push(await timed('search_keyword', () =>
    search({ ...common, query: KEYWORD_QUERY, mode: 'keyword' }),
  ));
  runs.push(await timed('search_semantic', () =>
    search({ ...common, query: SEARCH_QUERY, mode: 'semantic' }),
  ));
  runs.push(await timed('search_hybrid', () =>
    search({ ...common, query: SEARCH_QUERY, mode: 'hybrid' }),
  ));
  runs.push(await timed('search_auto', () =>
    search({ ...common, query: SEARCH_QUERY, mode: 'auto' }),
  ));
  runs.push(await timed('search_symbol', () =>
    search({ ...common, query: SYMBOL_QUERY, mode: 'symbol', limit: 10 }),
  ));

  runs.push(await timed('project_stats', () => projectStatsTool({ project_name: PROJECT })));
  runs.push(await timed('symbol_lookup', () =>
    symbolLookupTool({ project_name: PROJECT, symbol: SYMBOL_QUERY }),
  ));
  runs.push(await timed('list_projects', () => listProjectsTool()));

  const report = {
    model: process.env.OLLAMA_MODEL,
    embeddingDimensions: process.env.EMBEDDING_DIMENSIONS,
    ollamaUrl: process.env.OLLAMA_URL,
    qdrantUrl: process.env.QDRANT_URL,
    storagePath: process.env.STORAGE_PATH,
    project: PROJECT,
    fixture: FIXTURE,
    index: {
      ms: indexMs,
      ok: indexOk,
      totalChunks: chunksM ? parseInt(chunksM[1], 10) : null,
      qdrantVectors: qvM ? parseInt(qvM[1], 10) : null,
      ready: readyM ? readyM[1] : null,
    },
    tools: runs,
  };

  console.log(JSON.stringify(report));
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      fatal: true,
      error: e instanceof Error ? e.message : String(e),
    }),
  );
  process.exit(1);
});
