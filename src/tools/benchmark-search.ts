/**
 * Benchmark Search Tool (v0.9.4)
 *
 * Runs a suite of search queries with and without streaming,
 * and reports timing comparisons. Useful for measuring
 * vibe-hnindex performance on a given project.
 */
import { search } from './search.js';

interface BenchmarkQuery {
  label: string;
  query: string;
  mode: 'keyword' | 'semantic' | 'hybrid' | 'regex' | 'symbol';
  stream?: boolean;
  fuzzy?: boolean;
}

interface RunResult {
  label: string;
  mode: string;
  stream: boolean;
  fuzzy: boolean;
  runs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  resultCount: number;
}

const DEFAULT_QUERIES: BenchmarkQuery[] = [
  { label: 'Keyword — short identifier', query: 'useState', mode: 'keyword' },
  { label: 'Keyword — multi-word', query: 'export default function', mode: 'keyword' },
  { label: 'Hybrid — natural language', query: 'how to fetch data from API', mode: 'hybrid' },
  { label: 'Hybrid — code concept', query: 'authentication middleware', mode: 'hybrid' },
  { label: 'Regex — function defs', query: '/export (const|function) \\w+/', mode: 'regex' },
  { label: 'Fuzzy — typo test', query: 'fucntion', mode: 'keyword', fuzzy: true },
];

/** Warm-up query to prime caches and services */
const WARMUP_QUERY: BenchmarkQuery = {
  label: 'Warmup',
  query: 'import',
  mode: 'keyword',
};

async function runSingle(
  projectName: string,
  q: BenchmarkQuery,
  stream: boolean,
): Promise<{ elapsedMs: number; resultCount: number }> {
  const t0 = performance.now();
  const result = await search({
    query: q.query,
    project_name: projectName,
    mode: q.mode,
    limit: 5,
    stream,
    fuzzy: q.fuzzy ?? false,
  });
  const elapsedMs = Math.round(performance.now() - t0);

  // Parse result count from output
  const text = result.content[0]?.text || '';
  const match = text.match(/Found (\d+) results/);
  const resultCount = match ? parseInt(match[1], 10) : 0;

  return { elapsedMs, resultCount };
}

export async function benchmarkSearch(args: {
  project_name: string;
  queries?: BenchmarkQuery[];
  runs?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const queries = args.queries && args.queries.length > 0 ? args.queries : DEFAULT_QUERIES;
  const totalRuns = args.runs || 2;

  // Validate project exists
  const checkResult = await search({
    query: 'import',
    project_name: args.project_name,
    mode: 'keyword',
    limit: 1,
  });

  if (checkResult.content[0]?.text?.startsWith('Error:')) {
    return checkResult;
  }

  // Warm-up
  await runSingle(args.project_name, WARMUP_QUERY, false);
  await runSingle(args.project_name, WARMUP_QUERY, true);

  const results: RunResult[] = [];

  for (const q of queries) {
    // Non-streaming runs
    const noStreamTimes: number[] = [];
    let noStreamCount = 0;
    for (let i = 0; i < totalRuns; i++) {
      const { elapsedMs, resultCount } = await runSingle(args.project_name, q, false);
      noStreamTimes.push(elapsedMs);
      noStreamCount = resultCount;
    }

    results.push({
      label: q.label,
      mode: q.mode + (q.fuzzy ? '+fuzzy' : ''),
      stream: false,
      fuzzy: q.fuzzy ?? false,
      runs: totalRuns,
      avgMs: Math.round(noStreamTimes.reduce((a, b) => a + b, 0) / noStreamTimes.length),
      minMs: Math.min(...noStreamTimes),
      maxMs: Math.max(...noStreamTimes),
      resultCount: noStreamCount,
    });

    // Streaming runs (skip for regex/symbol — not applicable)
    if (q.mode !== 'regex' && q.mode !== 'symbol') {
      const streamTimes: number[] = [];
      let streamCount = 0;
      for (let i = 0; i < totalRuns; i++) {
        const { elapsedMs, resultCount } = await runSingle(args.project_name, q, true);
        streamTimes.push(elapsedMs);
        streamCount = resultCount;
      }

      results.push({
        label: q.label,
        mode: q.mode + (q.fuzzy ? '+fuzzy' : ''),
        stream: true,
        fuzzy: q.fuzzy ?? false,
        runs: totalRuns,
        avgMs: Math.round(streamTimes.reduce((a, b) => a + b, 0) / streamTimes.length),
        minMs: Math.min(...streamTimes),
        maxMs: Math.max(...streamTimes),
        resultCount: streamCount,
      });
    }
  }

  // Build output
  const lines = [
    `# 🔬 Search Benchmark — ${args.project_name}`,
    `Runs per query: ${totalRuns}`,
    '',
    '| Query | Mode | Stream | Avg | Min | Max | Results |',
    '|-------|------|--------|-----|-----|-----|---------|',
  ];

  for (const r of results) {
    const streamIcon = r.stream ? '⚡' : '  ';
    lines.push(
      `| ${r.label} | ${r.mode} | ${streamIcon} | ${r.avgMs}ms | ${r.minMs}ms | ${r.maxMs}ms | ${r.resultCount} |`,
    );
  }

  // Speedup summary
  lines.push('');
  lines.push('## ⚡ Streaming Speedup');

  for (let i = 0; i < results.length; i += 2) {
    if (i + 1 >= results.length) break;
    const noStream = results[i];
    const stream = results[i + 1];
    if (!stream.stream) break;

    const speedup = (noStream.avgMs / stream.avgMs).toFixed(1);
    const faster = noStream.avgMs > stream.avgMs ? '🚀' : '🐢';
    lines.push(
      `- ${faster} **${noStream.label}**: ${noStream.avgMs}ms → ${stream.avgMs}ms (**${speedup}x** faster with streaming)`,
    );
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}
