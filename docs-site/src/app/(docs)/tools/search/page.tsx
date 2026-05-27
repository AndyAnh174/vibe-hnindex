"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

const searchModes = [
  { mode: "keyword", mechanism: "SQLite FTS5 + BM25", bestFor: "Exact symbols, identifiers" },
  { mode: "semantic", mechanism: "Qdrant cosine similarity", bestFor: "Natural language queries" },
  { mode: "hybrid", mechanism: "RRF fusion (keyword + semantic)", bestFor: "General use (default)" },
  { mode: "auto", mechanism: "Heuristic keyword vs hybrid", bestFor: "Let the server decide" },
  { mode: "regex", mechanism: "RegExp pattern matching", bestFor: "Finding code patterns" },
  { mode: "symbol", mechanism: "SQLite symbol table", bestFor: "Finding definitions by name" },
];

export default function SearchPage() {
  const pageNav = getPageNav("search");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Tools", href: "/tools/search" },
        { label: "Search" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Tools</Badge>
      <h1>Search</h1>
      <p>
        The <code>search</code> tool is the core of vibe-hnindex. It lets AI assistants find
        code using keyword matching, semantic understanding, or both combined.
      </p>

      <h2 id="search-modes">Search Modes</h2>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-6">
        {searchModes.map((m) => (
          <Card key={m.mode} className="p-4">
            <code className="text-sm font-bold text-primary">{m.mode}</code>
            <p className="text-xs text-muted-foreground mt-1 mb-2">{m.mechanism}</p>
            <p className="text-xs">{m.bestFor}</p>
          </Card>
        ))}
      </div>

      <h2 id="basic-usage">Basic Usage</h2>
      <pre><code>{`search(
  query: "authentication middleware",
  project_name: "my-app",
  mode: "hybrid",
  limit: 10
)`}</code></pre>

      <h3 id="keyword-mode">Keyword Mode</h3>
      <p>
        Uses SQLite FTS5 full-text search with BM25 scoring. Best for exact symbols, function names,
        and identifiers.
      </p>
      <pre><code>{`search(
  query: "UserService",
  project_name: "my-app",
  mode: "keyword"
)`}</code></pre>

      <h3 id="semantic-mode">Semantic Mode</h3>
      <p>
        Uses Qdrant vector search with Ollama embeddings. Best for natural language queries
        where you don&apos;t know the exact function name.
      </p>
      <pre><code>{`search(
  query: "how does the app handle user login",
  project_name: "my-app",
  mode: "semantic"
)`}</code></pre>

      <h3 id="hybrid-mode">Hybrid Mode</h3>
      <p>
        Combines keyword and semantic search using Reciprocal Rank Fusion (RRF):
      </p>
      <pre><code>{`score(chunk) = 1/(60 + rank_keyword) + 1/(60 + rank_semantic)`}</code></pre>
      <p>Chunks appearing in both lists get higher combined scores.</p>

      <h3 id="auto-mode">Auto Mode</h3>
      <p>
        Let the server pick the best mode based on query shape. Short path-like queries
        lean keyword; longer question-like queries lean hybrid.
      </p>
      <pre><code>{`search(
  query: "authentication middleware",
  project_name: "my-app",
  mode: "auto"
)`}</code></pre>
      <p>
        Enable auto-routing by default: set <code>SEARCH_AUTO_ROUTE=true</code> in your MCP env.
      </p>

      <h2 id="regex-search">Regex Search (v0.8.0+)</h2>
      <p>
        Search using JavaScript regex patterns with <code>/pattern/flags</code> syntax:
      </p>
      <pre><code>{`// Find all useState calls
search(query: "/useState\\\\(.*\\\\)/", project_name: "my-app", mode: "regex")

// Find TODOs, FIXMEs, HACKs
search(query: "/TODO|FIXME|HACK/g", project_name: "my-app", mode: "regex")`}</code></pre>
      <ul>
        <li>Pattern wrapped in <code>/pattern/flags</code> — flags are optional (default <code>i</code>)</li>
        <li>Supports all standard JS regex flags: <code>g</code>, <code>i</code>, <code>m</code>, <code>s</code>, <code>u</code>, <code>y</code></li>
        <li>Auto-detection: when <code>mode</code> is <code>auto</code> and query looks like <code>/.../</code>, regex mode is selected</li>
        <li>Matches are highlighted with <code>**text**</code> in output</li>
        <li>Results sorted by match count descending</li>
      </ul>

      <h2 id="symbol-filters">Symbol Filters (v0.8.0+)</h2>
      <p>Filter results to files containing specific symbol types:</p>
      <table>
        <thead>
          <tr><th>Kind</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>function</code></td><td>Function definitions</td></tr>
          <tr><td><code>class</code></td><td>Class definitions</td></tr>
          <tr><td><code>method</code></td><td>Class/object methods</td></tr>
          <tr><td><code>interface</code></td><td>Interface definitions</td></tr>
          <tr><td><code>type</code></td><td>Type alias definitions</td></tr>
          <tr><td><code>variable</code></td><td>Variable declarations</td></tr>
          <tr><td><code>enum</code></td><td>Enum definitions</td></tr>
          <tr><td><code>export</code></td><td>Exported symbols (any kind)</td></tr>
        </tbody>
      </table>
      <pre><code>{`search(query: "authentication", project_name: "my-app", symbol_kind: "class")
search(query: "handler", project_name: "my-app", symbol_kind: "function")
search(query: "UserData", project_name: "my-app", mode: "symbol", symbol_kind: "interface")`}</code></pre>

      <h2 id="search-tips">Search Tips</h2>
      <ul>
        <li>Narrow <code>file_pattern</code> and <code>limit</code> on the first pass</li>
        <li>Use <code>keyword</code> when you know exact symbols</li>
        <li>Set <code>dedupe_by_file: false</code> only when you need multiple chunks from the same file</li>
        <li>Use <code>explain: true</code> for a per-result score breakdown (path multiplier, RRF ranks)</li>
      </ul>

      <Separator className="my-8" />

      <h2 id="fuzzy-search">Fuzzy Search (v0.8.1+)</h2>
      <p>
        Boost results using Levenshtein distance for approximate string matching — useful for
        misspelled queries or finding similar identifiers.
      </p>
      <pre><code>{`search(query: "authentication midleware", project_name: "my-app", fuzzy: true)
search(query: "fucntion handleReq", project_name: "my-app", fuzzy: true)`}</code></pre>
      <p>
        Enable globally: <code>SEARCH_FUZZY_ENABLED=true</code>.
      </p>

      <h2 id="streaming-search">Streaming Search (v0.9.0+)</h2>
      <p>
        Runs keyword + semantic in parallel for ~1.5-2× faster hybrid search:
      </p>
      <pre><code>{`search(query: "authentication", project_name: "my-app", stream: true)`}</code></pre>
      <p>
        Enable globally: <code>SEARCH_STREAM_ENABLED=true</code>. Provides 4-phase progress
        notifications and early result preview via MCP logging.
      </p>

      <h2 id="search-cache">Search Cache (v0.8.0+)</h2>
      <p>
        Results are cached with LRU eviction and 5-minute TTL. Cache key includes project name,
        query, mode, limit, and filters. Automatically invalidated on re-index. Not used for regex mode.
      </p>

      <h2 id="rerank">Rerank</h2>
      <p>
        After retrieval, results can be reordered. Without <code>RERANK_URL</code>, Qdrant semantic
        scores are used. With <code>RERANK_URL</code>, results are sent to your custom HTTP endpoint.
        See <a href="/configuration#optional-rerank">Configuration → Optional Rerank</a>.
      </p>
    </DocsLayout>
  );
}
