"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

export default function PerformancePage() {
  const pageNav = getPageNav("performance");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides", href: "/guides/setup-mcp" },
        { label: "Performance" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Guides</Badge>
      <h1>Performance</h1>
      <p>
        Optimizing vibe-hnindex for maximum indexing speed and search responsiveness.
      </p>

      <h2 id="indexing-performance">Indexing Performance</h2>

      <h3 id="parallel-workers">Parallel Workers</h3>
      <p>
        Since v0.8.0, <code>index_codebase</code> uses worker threads for parallel processing.
        The default <code>INDEX_WORKERS=auto</code> uses all CPU cores minus one.
      </p>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <Card className="p-4">
          <h4 className="text-sm font-bold text-primary mb-2">Single-threaded</h4>
          <pre><code className="text-xs">INDEX_WORKERS=1</code></pre>
          <p className="text-xs text-muted-foreground mt-2">
            Baseline. One file at a time. Good for low-resource machines.
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-bold text-primary mb-2">Multi-threaded (auto)</h4>
          <pre><code className="text-xs">INDEX_WORKERS=auto</code></pre>
          <p className="text-xs text-muted-foreground mt-2">
            ~3-4× faster on multi-core machines. Default setting.
          </p>
        </Card>
      </div>

      <h3 id="batch-size">Batch Size</h3>
      <p>
        <code>INDEX_PARALLEL_BATCH</code> controls files per worker batch (default: 8).
        Higher values increase throughput but use more memory:
      </p>
      <pre><code>{`INDEX_PARALLEL_BATCH=16  # Faster, more memory
INDEX_PARALLEL_BATCH=4   # Slower, less memory`}</code></pre>

      <Separator className="my-8" />

      <h2 id="search-performance">Search Performance</h2>

      <h3 id="streaming">Streaming Search (v0.9.0+)</h3>
      <p>
        Streaming search runs keyword + semantic in parallel, providing ~1.5-2× speedup for hybrid mode:
      </p>
      <pre><code>{`SEARCH_STREAM_ENABLED=true`}</code></pre>
      <p>
        Streaming provides 4-phase progress notifications:
      </p>
      <ol>
        <li>Parallel Search — keyword and semantic run simultaneously</li>
        <li>RRF Fusion — combined scoring</li>
        <li>Post-processing — deduplication and path quality</li>
        <li>Results — final ranked output</li>
      </ol>

      <h3 id="caching">Search Cache</h3>
      <p>
        Results are cached with LRU eviction (default 100 entries, 5 min TTL):
      </p>
      <pre><code>{`SEARCH_CACHE_SIZE=200        # More cache entries
SEARCH_CACHE_TTL_MS=600000   # Longer TTL (10 min)`}</code></pre>
      <blockquote>
        Set <code>SEARCH_CACHE_TTL_MS=0</code> to disable caching for benchmarking.
      </blockquote>

      <h3 id="mode-selection">Mode Selection Strategy</h3>
      <p>Choose the right search mode for optimal performance:</p>
      <table>
        <thead>
          <tr><th>Scenario</th><th>Best Mode</th><th>Why</th></tr>
        </thead>
        <tbody>
          <tr><td>Exact symbol/function name</td><td>keyword</td><td>Fastest — no embedding needed</td></tr>
          <tr><td>Natural language question</td><td>semantic</td><td>Embedding overhead but better relevance</td></tr>
          <tr><td>General search</td><td>hybrid</td><td>Best results; moderate overhead</td></tr>
          <tr><td>Code patterns</td><td>regex</td><td>Bypasses FTS/embeddings entirely</td></tr>
          <tr><td>Find definitions</td><td>symbol</td><td>Quick SQLite lookup</td></tr>
        </tbody>
      </table>

      <Separator className="my-8" />

      <h2 id="timeouts">Timeout Tuning</h2>
      <p>
        Adjust timeouts for slow machines or remote services:
      </p>
      <pre><code>{`OLLAMA_TIMEOUT_MS=60000   # 60s for slow Ollama
QDRANT_TIMEOUT_MS=30000   # 30s for remote Qdrant
SEARCH_TIMEOUT_MS=120000  # 2min overall timeout`}</code></pre>

      <h2 id="hardware-recommendations">Hardware Recommendations</h2>
      <table>
        <thead>
          <tr><th>Component</th><th>Minimum</th><th>Recommended</th></tr>
        </thead>
        <tbody>
          <tr><td>CPU</td><td>2 cores</td><td>4+ cores (for parallel indexing)</td></tr>
          <tr><td>RAM</td><td>4 GB</td><td>8+ GB (embedding models)</td></tr>
          <tr><td>Storage</td><td>SSD with 2 GB free</td><td>NVMe with 10+ GB free</td></tr>
        </tbody>
      </table>

      <h2 id="benchmarking">Benchmarking</h2>
      <p>
        Use the <code>benchmark_search</code> tool to measure performance:
      </p>
      <pre><code>{`benchmark_search(project_name: "my-app")`}</code></pre>
      <p>
        See <a href="/tools/benchmark">Benchmark docs</a> for interpreting results.
      </p>

      <h2 id="single-pass">Single-Pass Indexing (v0.9.1+)</h2>
      <p>
        Since v0.9.1, indexing uses a single pass for chunking + embedding + dependency/symbol
        parsing instead of two passes. Combined with SHA-1 for change detection, this makes
        indexing ~30-40% faster on large codebases.
      </p>

      <Separator className="my-8" />

      <h2 id="embedding-model-performance">Embedding Model Performance</h2>
      <p>
        The embedding model significantly impacts indexing speed. Larger models produce better
        vectors but take longer per chunk:
      </p>

      <table>
        <thead>
          <tr><th>Model</th><th>RAM</th><th>GPU?</th><th>Latency/Chunk</th><th>Index 1k Files*</th></tr>
        </thead>
        <tbody>
          <tr><td><code>all-minilm</code></td><td>~100 MB</td><td>No</td><td>~5 ms</td><td>~30 sec</td></tr>
          <tr><td><code>nomic-embed-text</code></td><td>~400 MB</td><td>Optional</td><td>~15 ms</td><td>~1.5 min</td></tr>
          <tr><td><code>bge-m3:567m</code></td><td>~1.5 GB</td><td>Recommended</td><td>~25 ms</td><td>~2.5 min</td></tr>
          <tr><td><code>qwen3-embedding:4b</code></td><td>~3 GB (Q4)</td><td>Required</td><td>~40 ms</td><td>~4 min</td></tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        * Estimated indexing time for 1,000 source files with 60-line chunks (single worker).
        Actuals vary with file size, hardware, and parallel workers.
      </p>

      <h3>VRAM Impact</h3>
      <p>
        Models that fit entirely in GPU VRAM generate embeddings <strong>5-30× faster</strong> than
        models that spill to system RAM. Always check quantization level:
      </p>
      <table>
        <thead>
          <tr><th>Quantization</th><th>Memory Reduction</th><th>Quality Impact</th></tr>
        </thead>
        <tbody>
          <tr><td>F16 (default)</td><td>Baseline</td><td>None</td></tr>
          <tr><td>Q8_0</td><td>~50%</td><td>Negligible</td></tr>
          <tr><td>Q5_K_M</td><td>~65%</td><td>Minimal</td></tr>
          <tr><td>Q4_K_M</td><td>~75%</td><td>Moderate</td></tr>
        </tbody>
      </table>
      <pre><code>{`# Pull a quantized model
ollama pull nomic-embed-text:Q8_0
ollama pull qwen3-embedding:4b-Q4_K_M`}</code></pre>

      <h3>Matryoshka Dimension Reduction</h3>
      <p>
        <code>nomic-embed-text</code> and <code>snowflake-arctic-embed2</code> support
        Matryoshka Representation Learning — you can reduce dimensions (e.g., 768 → 512)
        while keeping ~90% quality, saving memory and Qdrant storage:
      </p>
      <pre><code>{`EMBEDDING_DIMENSIONS=512   # Slower to compute but uses less Qdrant storage
EMBEDDING_DIMENSIONS=256   # Even smaller, still usable quality`}</code></pre>
    </DocsLayout>
  );
}
