"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function IndexCodebasePage() {
  const pageNav = getPageNav("index-codebase");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Tools", href: "/tools/search" },
        { label: "Index Codebase" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Tools</Badge>
      <h1>Index Codebase</h1>
      <p>
        The <code>index_codebase</code> tool scans and indexes an entire directory. It supports
        incremental re-indexing, parallel processing, and automatic file watching.
      </p>

      <h2 id="basic-usage">Basic Usage</h2>
      <pre><code>{`index_codebase(path: "/path/to/project", project_name: "my-app")`}</code></pre>

      <h2 id="response">Response</h2>
      <p>The response includes:</p>
      <ul>
        <li><code>Ready: yes</code> or <code>Ready: no</code> — whether indexing completed</li>
        <li><code>qdrant_vectors: {"&lt;count&gt;"}</code> — number of vectors stored (when Qdrant is available)</li>
        <li>Summary of files processed, skipped, and errors</li>
      </ul>

      <h2 id="incremental-indexing">Incremental Indexing</h2>
      <p>
        vibe-hnindex uses SHA-1 hashing to detect file changes. Only files with changed hashes
        are re-processed, making subsequent indexes fast.
      </p>
      <p>Re-run the same command to update an existing index:</p>
      <pre><code>{`index_codebase(path: "/path/to/project", project_name: "my-app")`}</code></pre>

      <h2 id="watch-mode">Watch Mode</h2>
      <p>
        By default (<code>watch: true</code>), vibe-hnindex starts a file watcher after indexing.
        The watcher automatically re-indexes changed files in real-time.
      </p>
      <pre><code>{`index_codebase(path: "/path/to/project", project_name: "my-app", watch: true)`}</code></pre>
      <p>Disable watching:</p>
      <pre><code>{`index_codebase(path: "/path/to/project", project_name: "my-app", watch: false)`}</code></pre>

      <h2 id="indexing-pipeline">Indexing Pipeline</h2>
      <pre><code>{`Scan directory → filter (40+ extensions; skip node_modules, .git, dist…)
  → SHA-1 hash → skip unchanged files
  → chunk (≈60 lines, boundary-aware, overlap)
  → embed (Ollama bge-m3, batch 32, 1024-dim)
  → SQLite (text + FTS5) + Qdrant (vectors)`}</code></pre>

      <h2 id="parallel-indexing">Parallel Indexing (v0.8.0+)</h2>
      <p>
        <code>index_codebase</code> uses worker threads for parallel chunking and embedding.
        By default, it uses CPU count - 1 workers (~3-4× faster on multi-core machines).
      </p>
      <p>
        Configure via environment variables:
      </p>
      <pre><code>{`# MCP env
INDEX_WORKERS=auto     # Use all available cores (default)
INDEX_WORKERS=4         # Manual: use exactly 4 workers
INDEX_WORKERS=1         # Single-threaded
INDEX_PARALLEL_BATCH=16 # Files per batch`}</code></pre>

      <h2 id="supported-languages">Supported Languages</h2>
      <p>
        TypeScript, JavaScript, Python, Java, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin,
        Scala, Lua, Bash, SQL, Vue, Svelte, HTML, CSS, SCSS, YAML, TOML, JSON, XML, Markdown,
        Protobuf, GraphQL, Terraform, Zig, Elixir, Erlang, Clojure, Haskell, OCaml, F#, Dart,
        Solidity, CMake, Gradle, Dockerfile, Makefile, and more.
      </p>

      <Separator className="my-8" />

      <h2 id="excluded-files">Excluded Files</h2>
      <p>By default, these are skipped:</p>
      <ul>
        <li><code>node_modules</code>, <code>.git</code>, <code>dist</code>, <code>build</code></li>
        <li><code>__pycache__</code>, <code>vendor</code></li>
        <li>Lockfiles, binaries</li>
        <li>Files larger than <code>MAX_FILE_SIZE</code> (default 1 MB)</li>
      </ul>
      <p>
        Customize with <code>.hnindexignore</code> — see{" "}
        <a href="/configuration#hnindexignore">Configuration → .hnindexignore</a>.
      </p>

      <h2 id="single-file">Indexing a Single File</h2>
      <p>For re-indexing a single file in an existing project:</p>
      <pre><code>{`index_file(file_path: "/path/to/file.ts", project_name: "my-app")`}</code></pre>

      <h2 id="related-tools">Related Tools</h2>
      <ul>
        <li><code>list_projects</code> — Lists all indexed projects with metadata</li>
        <li><code>delete_project(project_name: "my-app")</code> — Removes a project from SQLite and Qdrant</li>
        <li><code>get_file_info(file_path: "...", project_name: "...")</code> — Metadata for a specific indexed file</li>
      </ul>
    </DocsLayout>
  );
}
