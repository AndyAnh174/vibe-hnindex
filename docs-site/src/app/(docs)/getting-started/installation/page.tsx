"use client";
import Link from "next/link";
import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { VERSION } from "@/lib/release";
export default function Installation() {
  return (
    <DocsLayout
      breadcrumbs={[{ label: "Docs", href: "/" }, { label: "Installation" }]}
      pageNav={getPageNav("installation")}
    >
      <p className="doc-eyebrow">GETTING STARTED / v{VERSION}</p>
      <h1>Installation</h1>
      <p className="docs-lead">
        Start with local workspace context and TS/JS code navigation. Add
        semantic retrieval when your workflow needs it.
      </p>
      <h2 id="requirements">Requirements</h2>
      <ul>
        <li>Node.js 22 or newer and npm.</li>
        <li>
          An MCP client such as Codex, Claude Code, Cursor, VS Code, Windsurf or
          Antigravity.
        </li>
        <li>
          A readable project directory. SQLite storage defaults to{" "}
          <code>~/.vibe-hnindex</code>.
        </li>
      </ul>
      <p>
        Workspace context and <code>index_code_graph</code> do not require
        Qdrant, Ollama or a cloud API key. AST graph analysis currently supports
        TypeScript and JavaScript.
      </p>
      <h2 id="connect">Connect your editor</h2>
      <pre>
        <code>
          {
            "cd /your/project\nnpx -y hnindex-cli init --mcp codex\nnpx -y hnindex-cli init --mcp claude\n\n# Other project-scoped targets\nnpx -y hnindex-cli init --mcp cursor-project\nnpx -y hnindex-cli init --mcp vscode"
          }
        </code>
      </pre>
      <p>
        Project-scoped targets bind <code>HNINDEX_PROJECT_ROOT</code>{" "}
        automatically. For a global configuration, either use current MCP client
        roots or bind a root explicitly:
      </p>
      <pre>
        <code>
          {
            "npx -y hnindex-cli init --mcp windsurf --project-root /your/project"
          }
        </code>
      </pre>
      <p>
        Restart or reconnect your MCP client after updating its configuration.
        Follow the <Link href="/getting-started/quick-start">quick start</Link>{" "}
        to initialize the local graph.
      </p>
      <h2 id="codex">Codex</h2>
      <p>The Codex target writes project <code>.codex/config.toml</code> and binds the workspace automatically. Codex loads this file only for trusted projects. Restart or reconnect Codex after setup.</p>
      <pre><code>{"npx -y hnindex-cli init --mcp codex\nnpx -y hnindex-cli init-skill --target codex"}</code></pre>
      <p>The optional skill is installed in <code>.agents/skills/use-vibe-hnindex</code>. See the <Link href="/guides/setup-mcp">Codex MCP setup</Link> for TOML and connection checks.</p>
      <h2 id="semantic">Optional: semantic and hybrid retrieval</h2>
      <p>
        Full codebase vector indexing and semantic/hybrid search use Qdrant plus
        your chosen provider: Ollama, OpenAI, Voyage, Gemini or an
        OpenAI-compatible endpoint.
      </p>
      <pre>
        <code>
          {
            "docker run -d --name hnindex-qdrant -p 6333:6333 \\\n  -v hnindex-qdrant:/qdrant/storage qdrant/qdrant\n\n# For local embeddings only (Ollama installed separately):\nollama pull bge-m3:567m"
          }
        </code>
      </pre>
      <p>
        Configure <code>EMBEDDING_PROVIDER</code> and the matching key/model in
        the MCP server environment. See{" "}
        <Link href="/configuration">configuration</Link> for settings. Cloud
        embeddings send code chunks to that provider; Ollama can keep embedding
        traffic local.
      </p>
      <h2 id="verify">Verify the connection</h2>
      <p>
        Ask the agent to call <code>workspace_context</code> with the project
        path, then <code>index_code_graph</code>. Use <code>diagnostics</code>{" "}
        when troubleshooting optional embedding and Qdrant services. Do not
        treat a missing optional service as a prerequisite for offline graph
        navigation.
      </p>
    </DocsLayout>
  );
}
