"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

export default function TroubleshootingPage() {
  const pageNav = getPageNav("troubleshooting");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides", href: "/guides/setup-mcp" },
        { label: "Troubleshooting" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Guides</Badge>
      <h1>Troubleshooting</h1>
      <p>
        Common issues and their solutions when working with vibe-hnindex.
      </p>

      <h2 id="windows-npm-install">Windows npm Install</h2>
      <p>
        The most common issue on Windows is failing to install because of native dependencies.
      </p>

      <h3>Symptoms</h3>
      <ul>
        <li><code>npm i vibe-hnindex</code> fails</li>
        <li>Log mentions <code>better-sqlite3</code>, <code>prebuild-install</code>, <code>node-gyp</code></li>
        <li>Error about <code>No prebuilt binaries found</code></li>
        <li>Reference to <strong>Visual Studio</strong> or <strong>Desktop development with C++</strong></li>
      </ul>

      <h3>Why</h3>
      <p>
        <code>better-sqlite3</code> contains native code. npm either downloads a prebuilt binary
        or compiles with <code>node-gyp</code>. On some Node + Windows combinations, there is no
        prebuild, so npm tries to compile — which requires Visual Studio Build Tools.
      </p>

      <h3>Solutions (pick one)</h3>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        <Card className="p-4">
          <h4 className="text-sm font-bold text-primary mb-2">1. Use LTS Node</h4>
          <p className="text-xs text-muted-foreground">
            Use Node.js 20.x or 22.x LTS. Many LTS versions have prebuilt
            <code>better-sqlite3</code>. No compiler needed.
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-bold text-primary mb-2">2. Install Build Tools</h4>
          <p className="text-xs text-muted-foreground">
            Install{" "}
            <a href="https://visualstudio.microsoft.com/visual-cpp-build-tools/" target="_blank" rel="noopener noreferrer">
              Visual Studio Build Tools
            </a>{" "}
            with workload &quot;Desktop development with C++&quot;.
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-bold text-primary mb-2">3. Avoid Bleeding Edge</h4>
          <p className="text-xs text-muted-foreground">
            Avoid very new Node versions on Windows — prebuilds often lag behind.
          </p>
        </Card>
      </div>

      <blockquote>
        Deprecation warnings (<code>fs.R_OK</code>, <code>url.parse</code>) are noisy but usually
        not the root cause. The real failure is <code>node-gyp</code> / missing VS or no prebuild.
      </blockquote>

      <Separator className="my-8" />

      <h2 id="runtime-errors">Runtime Error Handling</h2>
      <table>
        <thead>
          <tr><th>Situation</th><th>Behavior</th></tr>
        </thead>
        <tbody>
          <tr><td>Ollama unavailable</td><td>Error message; <strong>keyword</strong> search still works</td></tr>
          <tr><td>Qdrant unavailable</td><td>Error message; <strong>keyword</strong> search still works</td></tr>
          <tr><td>Hybrid with services down</td><td>Falls back to keyword + warning</td></tr>
          <tr><td>Unreadable/huge/binary file</td><td>Skipped; reported in index summary</td></tr>
        </tbody>
      </table>

      <Separator className="my-8" />

      <h2 id="qdrant-cloud">Qdrant Cloud Issues</h2>
      <h3>401 / Auth Errors</h3>
      <ul>
        <li>Set <code>QDRANT_API_KEY</code> to the key from your Qdrant Cloud dashboard</li>
        <li>Ensure <code>QDRANT_URL</code> is the exact HTTPS endpoint with port (<code>:6333</code>)</li>
      </ul>

      <h3>Connection Timeout</h3>
      <ul>
        <li>Increase <code>QDRANT_TIMEOUT_MS</code> (default 15s) for remote clusters</li>
      </ul>

      <h2 id="ollama-issues">Ollama Issues</h2>
      <h3>Model Not Found</h3>
      <pre><code>ollama pull bge-m3:567m</code></pre>
      <p>
        Verify the model is pulled and <code>ollama serve</code> is running.
      </p>

      <h3>Switching Embedding Models</h3>
      <p>
        Changing <code>OLLAMA_MODEL</code> requires updating <code>EMBEDDING_DIMENSIONS</code> and re-indexing:
      </p>
      <ol>
        <li>Pull the new model: <code>ollama pull nomic-embed-text</code></li>
        <li>Update MCP env: <code>OLLAMA_MODEL=nomic-embed-text</code>, <code>EMBEDDING_DIMENSIONS=768</code></li>
        <li>Delete existing project: <code>delete_project(project_name: "my-app")</code></li>
        <li>Re-index: <code>index_codebase(path: "/path", project_name: "my-app")</code></li>
        <li>Verify: <code>server_diagnostics()</code></li>
      </ol>
      <blockquote>
        The Qdrant collection is created with a fixed vector size. Changing the embedding
        model without deleting + re-indexing will cause dimension mismatch errors.
      </blockquote>

      <h3>Dimension Mismatch</h3>
      <p>
        If you see errors like "dimension mismatch" or "wrong vector size", it means
        <code>EMBEDDING_DIMENSIONS</code> doesn&apos;t match the model&apos;s actual output.
        Delete the Qdrant collection and re-create it with the correct dimensions.
      </p>
      <table>
        <thead>
          <tr><th>Model</th><th>Correct Dimension</th></tr>
        </thead>
        <tbody>
          <tr><td><code>bge-m3:567m</code></td><td><code>1024</code></td></tr>
          <tr><td><code>nomic-embed-text</code></td><td><code>768</code></td></tr>
          <tr><td><code>mxbai-embed-large</code></td><td><code>1024</code></td></tr>
          <tr><td><code>all-minilm</code></td><td><code>384</code></td></tr>
          <tr><td><code>snowflake-arctic-embed2</code></td><td><code>1024</code></td></tr>
          <tr><td><code>qwen3-embedding</code></td><td><code>32-4096</code> (configurable)</td></tr>
        </tbody>
      </table>

      <h3>Remote Ollama</h3>
      <p>
        Set <code>OLLAMA_URL=http://your-server:11434</code> in MCP env.
        Increase <code>OLLAMA_TIMEOUT_MS</code> for remote servers.
      </p>

      <Separator className="my-8" />

      <h2 id="faq">FAQ</h2>

      <div className="space-y-6">
        <div>
          <h4 className="font-semibold">Where is data stored?</h4>
          <p>SQLite: <code>~/.vibe-hnindex/knowledge.db</code> (or <code>STORAGE_PATH</code>). Qdrant: your Docker volume or Cloud project.</p>
        </div>

        <div>
          <h4 className="font-semibold">Does a new chat lose the index?</h4>
          <p>No. Data is on disk until you run <code>delete_project</code>.</p>
        </div>

        <div>
          <h4 className="font-semibold">Is Docker required?</h4>
          <p>Only for self-hosted Qdrant. Keyword mode works without Qdrant or Ollama.</p>
        </div>

        <div>
          <h4 className="font-semibold">Can Ollama run on another machine?</h4>
          <p>Yes — set <code>OLLAMA_URL</code> in MCP <code>env</code>.</p>
        </div>

        <div>
          <h4 className="font-semibold">Is re-indexing slow?</h4>
          <p>No. Incremental indexing only reprocesses files with changed SHA-1 hashes.</p>
        </div>

        <div>
          <h4 className="font-semibold">Can I use vibe-hnindex without Ollama?</h4>
          <p>Yes — keyword search (FTS5) works without Ollama. Only semantic/hybrid need embeddings.</p>
        </div>

        <div>
          <h4 className="font-semibold">Can I use vibe-hnindex without Docker?</h4>
          <p>Yes — keyword search works without Qdrant. Use Qdrant Cloud if you don&apos;t want Docker.</p>
        </div>
      </div>

      <Separator className="my-8" />

      <h2 id="diagnostics">Running Diagnostics</h2>
      <p>
        Use the <code>server_diagnostics</code> tool for a health check:
      </p>
      <pre><code>{`server_diagnostics()
server_diagnostics(project_name: "my-app")`}</code></pre>
      <p>This checks:</p>
      <ul>
        <li>Ollama reachability</li>
        <li>Embedding probe (optional: <code>embedSingle(&quot;ping&quot;)</code>)</li>
        <li>Qdrant reachability</li>
        <li>Config summary</li>
        <li>Project-specific: SQLite vs Qdrant chunk count comparison</li>
      </ul>
    </DocsLayout>
  );
}
