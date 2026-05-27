"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function BenchmarkPage() {
  const pageNav = getPageNav("benchmark");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Tools", href: "/tools/search" },
        { label: "Benchmark" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Tools · v0.9.5</Badge>
      <h1>Benchmark</h1>
      <p>
        The <code>benchmark_search</code> tool runs a battery of test queries across different
        search modes and reports comparative performance metrics. One command gives you a full
        performance comparison table.
      </p>

      <h2 id="what-it-measures">What It Measures</h2>
      <ul>
        <li><strong>Keyword search</strong> — FTS5 + BM25 performance</li>
        <li><strong>Hybrid search</strong> — RRF fusion of keyword + semantic</li>
        <li><strong>Regex search</strong> — Pattern matching over code</li>
        <li><strong>Fuzzy search</strong> — Levenshtein distance re-ranking</li>
        <li><strong>Streaming vs non-streaming</strong> — Speedup comparison</li>
      </ul>

      <h2 id="usage">Usage</h2>
      <pre><code>{`benchmark_search(project_name: "my-app")`}</code></pre>

      <h2 id="output">Output</h2>
      <p>The benchmark produces a comparison table with these metrics:</p>
      <table>
        <thead>
          <tr><th>Metric</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td>Average time</td><td>Mean execution time across all test queries</td></tr>
          <tr><td>Min time</td><td>Fastest single query</td></tr>
          <tr><td>Max time</td><td>Slowest single query</td></tr>
          <tr><td>Result count</td><td>Number of results returned</td></tr>
          <tr><td>Speedup ratio</td><td>Streaming vs non-streaming comparison</td></tr>
        </tbody>
      </table>

      <h2 id="test-queries">Test Queries</h2>
      <p>The benchmark runs multiple queries designed to stress different search paths:</p>
      <ul>
        <li>Short keyword queries (exact symbol matching)</li>
        <li>Natural language queries (semantic understanding)</li>
        <li>Regex pattern queries (pattern matching)</li>
        <li>Fuzzy queries with misspellings</li>
        <li>Each query is run with and without streaming for comparison</li>
      </ul>

      <Separator className="my-8" />

      <h2 id="when-to-use">When to Use</h2>
      <ul>
        <li><strong>After indexing</strong> a new project — verify search performance</li>
        <li><strong>Tuning configuration</strong> — compare before/after env changes</li>
        <li><strong>Troubleshooting</strong> — identify slow search paths</li>
        <li><strong>Hardware changes</strong> — assess impact of more CPUs/memory</li>
      </ul>

      <h2 id="interpreting-results">Interpreting Results</h2>
      <h3>Streaming Speedup</h3>
      <p>
        Streaming search typically shows ~1.5-2× speedup for hybrid mode since keyword and
        semantic searches run in parallel instead of sequentially.
      </p>

      <h3>Mode Performance</h3>
      <p>
        Keyword search is typically fastest (no embedding generation). Hybrid adds ~30-50%
        overhead for embedding but provides better semantic relevance. Regex performance
        depends on pattern complexity and codebase size.
      </p>

      <h2 id="tips">Tips</h2>
      <ul>
        <li>
          Run benchmarks with <code>SEARCH_CACHE_TTL_MS=0</code> to avoid cache skew
        </li>
        <li>
          Compare streaming enable/disable: set <code>SEARCH_STREAM_ENABLED</code> then re-run
        </li>
        <li>
          Results vary with project size — larger projects benefit more from parallel processing
        </li>
      </ul>
    </DocsLayout>
  );
}
