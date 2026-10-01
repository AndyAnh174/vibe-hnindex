import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { server: { type: 'string' }, output: { type: 'string' }, k: { type: 'string', default: '5' } } });
const serverRoot = path.resolve(values.server ?? repo);
const k = Number(values.k);
if (!Number.isInteger(k) || k < 1 || k > 50) throw new Error('--k must be 1–50');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hnindex-quality-'));
process.env.STORAGE_PATH = scratch;
process.env.SEARCH_KEYWORD_FALLBACK_SEMANTIC = 'false';
process.env.SEARCH_STREAM_ENABLED = 'false';
process.env.SEARCH_FUZZY_ENABLED = 'false';
process.env.SEARCH_RERANK = 'false';
process.env.CHAT_MEMORY_ENABLED = 'false';
const moduleAt = name => import(pathToFileURL(path.join(serverRoot, 'dist', name)));
const db = await moduleAt('services/sqlite.js');
const { chunkFile } = await moduleAt('services/chunker.js');
const { extractSymbols, toSymbolRecords } = await moduleAt('services/symbol-extractor.js');
const { scanDirectory } = await moduleAt('services/file-scanner.js');
const { search } = await moduleAt('tools/search.js');
const corpus = JSON.parse(fs.readFileSync(path.join(repo, 'benchmarks/retrieval-golden.json'), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(path.join(serverRoot, 'package.json'), 'utf8'));
let report;
try {
  db.initDatabase(); db.upsertProject('quality', repo);
  let files = 0;
  for await (const file of scanDirectory(repo)) {
    if (!file.relativePath.startsWith('src/') && !file.relativePath.startsWith('packages/hnindex-cli/src/')) continue;
    files++;
    db.insertChunks(chunkFile(file.content, file.relativePath).map(chunk => ({ ...chunk,
      id: crypto.randomUUID(), projectName: 'quality', filePath: file.relativePath, absolutePath: file.absolutePath,
      language: file.language, fileHash: crypto.createHash('sha1').update(file.content).digest('hex'), indexedAt: new Date().toISOString(),
    })));
    db.insertSymbols(toSymbolRecords('quality', file.relativePath, file.language, extractSymbols(file.content, file.language)));
  }
  db.updateProjectStats('quality', files, db.getProjectChunkCount('quality'));
  const rows = [];
  for (const test of corpus) {
    const start = performance.now();
    const response = await search({ project_name: 'quality', query: test.query, mode: test.mode, limit: k, rerank: false, dedupe_by_file: true });
    const ms = performance.now() - start;
    const text = response.content[0]?.text ?? '';
    const hits = [...text.matchAll(/^### \d+\. (.+?):\d+-\d+ \(/gm)].map(match => match[1]);
    const truth = new Set(test.expected_files);
    const relevant = hits.map(file => truth.has(file));
    const found = relevant.filter(Boolean).length;
    const first = relevant.indexOf(true);
    const dcg = relevant.reduce((sum, hit, index) => sum + (hit ? 1 / Math.log2(index + 2) : 0), 0);
    const ideal = Array.from({ length: Math.min(k, truth.size) }, (_, index) => 1 / Math.log2(index + 2)).reduce((a, b) => a + b, 0);
    rows.push({ ...test, hits, recall: found / truth.size, mrr: first < 0 ? 0 : 1 / (first + 1), ndcg: dcg / ideal, ms, error: text.startsWith('Error:') ? text : null });
  }
  const valid = rows.filter(row => !row.error);
  const mean = key => valid.length ? valid.reduce((sum, row) => sum + row[key], 0) / valid.length : 0;
  const times = valid.map(row => row.ms).sort((a, b) => a - b);
  report = { version: metadata.version, k, sourceFiles: files, chunks: db.getProjectChunkCount('quality'),
    totalCases: rows.length, successfulCases: valid.length, recallAtK: mean('recall'), mrr: mean('mrr'), ndcgAtK: mean('ndcg'),
    p95Ms: times.length ? times[Math.ceil(times.length * .95) - 1] : null,
    note: 'Same current source corpus across versions. Keyword/symbol only, offline, no reranking. One run per unique case; fresh database/cache. Timing includes cold queries. Does not measure semantic or answer quality.', rows };
  if (values.output) { fs.mkdirSync(path.dirname(path.resolve(values.output)), { recursive: true }); fs.writeFileSync(values.output, JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
} finally {
  db.getDb().close();
  fs.rmSync(scratch, { recursive: true, force: true });
}
// Older package versions leave search deadline timers alive; the report has been written synchronously.
process.exit(report?.successfulCases === corpus.length ? 0 : 1);
