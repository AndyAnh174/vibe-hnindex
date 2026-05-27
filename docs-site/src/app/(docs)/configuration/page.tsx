"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ConfigurationPage() {
  const pageNav = getPageNav("configuration");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Configuration" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Configuration</Badge>
      <h1>Configuration</h1>
      <p>
        Configure vibe-hnindex through environment variables set in your MCP config file.
        All variables are optional with sensible defaults.
      </p>

      <h2 id="environment-variables">Environment Variables</h2>

      <h3 id="core-config">Core Configuration</h3>
      <table>
        <thead>
          <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>OLLAMA_URL</code></td><td><code>http://localhost:11434</code></td><td>Ollama server URL</td></tr>
          <tr><td><code>OLLAMA_MODEL</code></td><td><code>bge-m3:567m</code></td><td>Embedding model name</td></tr>
          <tr><td><code>EMBEDDING_DIMENSIONS</code></td><td><code>1024</code></td><td>Vector size from Ollama model. Must match model output.</td></tr>
          <tr><td><code>STORAGE_PATH</code></td><td><code>~/.vibe-hnindex</code></td><td>SQLite database directory</td></tr>
          <tr><td><code>QDRANT_URL</code></td><td><code>http://localhost:6333</code></td><td>Qdrant REST URL</td></tr>
          <tr><td><code>QDRANT_API_KEY</code></td><td><em>(unset)</em></td><td>Required for Qdrant Cloud</td></tr>
          <tr><td><code>QDRANT_COLLECTION_PREFIX</code></td><td><code>mcp_ck_</code></td><td>Prefix for collection names</td></tr>
        </tbody>
      </table>

      <h3 id="chunking-config">Chunking Configuration</h3>
      <table>
        <thead>
          <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>CHUNK_SIZE</code></td><td><code>60</code></td><td>Target lines per chunk</td></tr>
          <tr><td><code>CHUNK_OVERLAP</code></td><td><code>5</code></td><td>Overlap lines between chunks</td></tr>
          <tr><td><code>MAX_FILE_SIZE</code></td><td><code>1048576</code></td><td>Max file size in bytes (1 MB)</td></tr>
        </tbody>
      </table>

      <h3 id="indexing-config">Indexing Configuration</h3>
      <table>
        <thead>
          <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>INDEX_WORKERS</code></td><td><code>auto</code></td><td>Worker threads for parallel indexing. <code>auto</code> = CPU count − 1. Set to <code>1</code> for single-thread.</td></tr>
          <tr><td><code>INDEX_PARALLEL_BATCH</code></td><td><code>8</code></td><td>Files per worker batch. Higher = more throughput, more memory.</td></tr>
        </tbody>
      </table>

      <h3 id="search-config">Search Configuration</h3>
      <table>
        <thead>
          <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>SEARCH_AUTO_ROUTE</code></td><td><code>false</code></td><td>When <code>true</code>, omitting <code>mode</code> uses <code>auto</code> heuristic.</td></tr>
          <tr><td><code>SEARCH_KEYWORD_FALLBACK_SEMANTIC</code></td><td><code>true</code></td><td>If keyword returns nothing, run semantic search.</td></tr>
          <tr><td><code>SEARCH_RERANK</code></td><td><em>(enabled)</em></td><td>Set to <code>false</code> to disable post-retrieval reorder.</td></tr>
          <tr><td><code>SEARCH_RERANK_POOL</code></td><td><code>50</code></td><td>Max candidates in rerank pool before trimming.</td></tr>
          <tr><td><code>SEARCH_CACHE_SIZE</code></td><td><code>100</code></td><td>Max cached search results (LRU).</td></tr>
          <tr><td><code>SEARCH_CACHE_TTL_MS</code></td><td><code>300000</code></td><td>Cache TTL in milliseconds (5 min).</td></tr>
          <tr><td><code>SEARCH_FUZZY_ENABLED</code></td><td><code>false</code></td><td>Enable fuzzy search re-ranking by default.</td></tr>
          <tr><td><code>SEARCH_STREAM_ENABLED</code></td><td><code>false</code></td><td>Enable streaming search by default.</td></tr>
        </tbody>
      </table>

      <h3 id="rerank-config">Rerank Configuration</h3>
      <table>
        <thead>
          <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>RERANK_URL</code></td><td><em>(empty)</em></td><td>Custom HTTP rerank endpoint. POST JSON <code>{`{query, documents}`}</code> → <code>{`{scores}`}</code>.</td></tr>
          <tr><td><code>RERANK_TIMEOUT_MS</code></td><td><code>15000</code></td><td>Timeout for rerank HTTP request.</td></tr>
        </tbody>
      </table>

      <h3 id="timeout-config">Timeout Configuration</h3>
      <table>
        <thead>
          <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>OLLAMA_TIMEOUT_MS</code></td><td><code>30000</code> (30s)</td><td>Max wait for Ollama API calls.</td></tr>
          <tr><td><code>QDRANT_TIMEOUT_MS</code></td><td><code>15000</code> (15s)</td><td>Max wait for Qdrant API calls.</td></tr>
          <tr><td><code>SEARCH_TIMEOUT_MS</code></td><td><code>60000</code> (60s)</td><td>Overall search operation timeout.</td></tr>
        </tbody>
      </table>

      <Separator className="my-8" />

      <h2 id="hnindexignore">.hnindexignore</h2>
      <p>
        Create a <code>.hnindexignore</code> file at the project root to exclude files and
        directories from indexing. Supports gitignore-style glob patterns via <code>minimatch</code>
        (<code>*</code>, <code>**</code>, <code>/</code>).
      </p>
      <pre><code>{`# .hnindexignore
node_modules
dist
build
*.min.js
*.lock
.git
__pycache__`}</code></pre>
      <blockquote>
        Re-index your project after changing this file. Negation (<code>!</code>) is not supported.
      </blockquote>

      <Separator className="my-8" />

      <h2 id="embedding-models">Embedding Model Selection</h2>
      <p>
        vibe-hnindex supports any <a href="https://ollama.com/search?c=embedding" target="_blank" rel="noopener noreferrer">Ollama embedding model</a>.
        Change <code>OLLAMA_MODEL</code> and <code>EMBEDDING_DIMENSIONS</code> to switch.
      </p>

      <h3>Model Comparison</h3>
      <table>
        <thead>
          <tr><th>Model</th><th>Size</th><th>Dims</th><th>Context</th><th>MTEB Score</th><th>Best For</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>bge-m3:567m</code> <Badge variant="secondary">default</Badge></td>
            <td>1.2 GB</td><td>1024</td><td>8192</td><td>~63</td>
            <td>Multilingual (100+ languages), multi-vector retrieval</td>
          </tr>
          <tr>
            <td><code>nomic-embed-text</code></td>
            <td>274 MB</td><td>768</td><td>8192</td><td>62.39</td>
            <td>Lightweight, CPU-friendly, Matryoshka dim reduction</td>
          </tr>
          <tr>
            <td><code>qwen3-embedding:4b</code></td>
            <td>2.5 GB (Q4)</td><td>32-4096</td><td>8192</td><td>~67</td>
            <td>Best quality with GPU, instruction support</td>
          </tr>
          <tr>
            <td><code>mxbai-embed-large</code></td>
            <td>670 MB</td><td>1024</td><td>512 ⚠️</td><td>64.68</td>
            <td>⚠️ Short context — not recommended for code</td>
          </tr>
          <tr>
            <td><code>snowflake-arctic-embed2</code></td>
            <td>1.1 GB</td><td>1024</td><td>8192</td><td>~58</td>
            <td>Multilingual, Matryoshka, smaller than bge-m3</td>
          </tr>
          <tr>
            <td><code>all-minilm</code></td>
            <td>46 MB</td><td>384</td><td>256</td><td>~56</td>
            <td>Prototyping, resource-constrained</td>
          </tr>
        </tbody>
      </table>

      <h3>How to Switch Models</h3>
      <pre><code>{`# 1. Pull the new model
ollama pull nomic-embed-text

# 2. Update MCP config env
OLLAMA_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768

# 3. Delete old Qdrant collection and re-index
delete_project(project_name: "my-app")
index_codebase(path: "/path/to/project", project_name: "my-app")`}</code></pre>
      <blockquote>
        After switching models, you <strong>must</strong> delete and re-index projects —
        Qdrant collection vector size is fixed at creation time.
      </blockquote>

      <h3>Recommendations</h3>
      <table>
        <thead>
          <tr><th>Scenario</th><th>Model</th><th>Reason</th></tr>
        </thead>
        <tbody>
          <tr><td>CPU only / low RAM</td><td><code>nomic-embed-text</code></td><td>274 MB, runs on CPU</td></tr>
          <tr><td>Multilingual codebase</td><td><code>bge-m3:567m</code></td><td>100+ languages, best multilingual</td></tr>
          <tr><td>GPU ≥ 8 GB VRAM</td><td><code>qwen3-embedding:4b</code></td><td>Highest quality with instruction support</td></tr>
          <tr><td>Minimal resources</td><td><code>all-minilm</code></td><td>46 MB, instant embedding</td></tr>
        </tbody>
      </table>

      <Separator className="my-8" />

      <h2 id="parallel-indexing">Parallel Indexing (v0.8.0+)</h2>
      <p>
        <code>INDEX_WORKERS</code> controls parallel file indexing using worker threads.
        Set to <code>auto</code> (or <code>0</code>) to use all available CPU cores minus one.
      </p>
      <pre><code>{`# Auto — use all available cores
export INDEX_WORKERS=auto

# Manual — use exactly 4 workers
export INDEX_WORKERS=4

# Single-threaded
export INDEX_WORKERS=1

# Larger batches
export INDEX_PARALLEL_BATCH=16`}</code></pre>

      <h2 id="search-cache">Search Cache (v0.8.0+)</h2>
      <p>
        Search results are cached in-memory with LRU eviction and TTL. The cache key includes
        project name, query, mode, limit, and filters. Cache is automatically invalidated on re-index
        and is not used for <code>regex</code> mode.
      </p>

      <h2 id="fuzzy-search">Fuzzy Search (v0.8.1+)</h2>
      <p>
        Enable Levenshtein distance-based fuzzy re-ranking to find results even with typos:
      </p>
      <pre><code>export SEARCH_FUZZY_ENABLED=true</code></pre>
      <p>Or enable per-query: <code>{`fuzzy: true`}</code> in the search arguments.</p>

      <h2 id="streaming-search">Streaming Search (v0.9.0+)</h2>
      <p>
        Streaming search runs keyword + semantic in parallel for faster results:
      </p>
      <pre><code>export SEARCH_STREAM_ENABLED=true</code></pre>
      <p>Provides 4-phase progress notifications and early result preview.</p>

      <h2 id="optional-rerank">Optional Rerank</h2>
      <p>
        After retrieval, vibe-hnindex can reorder results. Without <code>RERANK_URL</code>,
        it uses Qdrant semantic scores. With <code>RERANK_URL</code>, it sends results to
        your custom HTTP endpoint for finer ranking (e.g., cross-encoder).
      </p>
      <blockquote>
        Ollama does not provide a rerank endpoint. If you use an Ollama-hosted reranker model,
        you need a proxy that translates the <code>{`{query, documents}`}</code> → <code>{`{scores}`}</code> contract.
      </blockquote>
    </DocsLayout>
  );
}
