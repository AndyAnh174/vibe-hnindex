"use client";
import Link from "next/link";
import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { VERSION } from "@/lib/release";
export default function QuickStart() {
  return (
    <DocsLayout
      breadcrumbs={[{ label: "Docs", href: "/" }, { label: "Quick Start" }]}
      pageNav={getPageNav("quick-start")}
    >
      <p className="doc-eyebrow">GETTING STARTED / v{VERSION}</p>
      <h1>From a repo to useful context.</h1>
      <p className="docs-lead">
        Connect MCP, initialize a local graph, then give your agent a concrete
        task. This offline path needs Node 22+ and a TypeScript/JavaScript
        project.
      </p>
      <h2 id="connect">1. Connect MCP</h2>
      <p>
        Run in the project directory, then restart your editor’s MCP connection:
      </p>
      <pre>
        <code>
          {
            "npx -y hnindex-cli init --mcp claude\n# Cursor: --mcp cursor-project\n# VS Code: --mcp vscode\n# Global targets: add --project-root /your/project"
          }
        </code>
      </pre>
      <h2 id="orient">2. Inspect and index the workspace</h2>
      <p>
        The following examples are tool calls to request from your agent, not
        shell commands. Use an absolute path and a unique project name.
      </p>
      <pre>
        <code>
          {
            'workspace_context(path: "/your/project")\nindex_code_graph(path: "/your/project", project_name: "my-app")'
          }
        </code>
      </pre>
      <p>
        The graph stores source locations and relationships in SQLite. It
        requires no embedding key or Qdrant. If your repository uses other
        languages, use full <code>index_codebase</code> indexing with the
        configured services for keyword/vector chunks.
      </p>
      <h2 id="task">3. Declare the task</h2>
      <pre>
        <code>
          {
            'workspace_context(\n  project_name: "my-app",\n  task: "Add session expiry",\n  session_id: "agent-1"\n)'
          }
        </code>
      </pre>
      <p>
        hnindex returns purpose documents, live Git state and index readiness.
        The declared task persists per project/session in SQLite. Git changes
        are evidence; they do not reveal your objective. Use distinct session
        IDs for concurrent agents.
      </p>
      <h2 id="locate">4. Locate before editing</h2>
      <pre>
        <code>
          {
            'locate_code(project_name: "my-app", symbol: "verifySession")\nlocate_code(project_name: "my-app", query: "src/auth/session.ts")'
          }
        </code>
      </pre>
      <p>
        Inspect paths, lines, source excerpts, ambiguity and freshness. Auto
        mode tries file, symbol and local keyword lookup without embeddings.
        Re-index changed code; use filesystem search for excluded, missing or
        stale results.
      </p>
      <h2 id="retrieval">5. Add semantic retrieval when useful</h2>
      <p>
        Configure Qdrant and your embedding provider, then request{" "}
        <code>
          index_codebase(path: "/your/project", project_name: "my-app")
        </code>
        . Explicit <code>locate_code</code> hybrid mode uses these services and
        can incur provider costs. Switching providers/models/dimensions requires
        full re-indexing.
      </p>
      <div className="docs-note">
        <strong>Next steps</strong>
        <p>
          Explore <Link href="/tools/workspace">workspace and locations</Link>,{" "}
          <Link href="/tools/code-graph">code graph tools</Link> and{" "}
          <Link href="/configuration">embedding configuration</Link>.
        </p>
      </div>
    </DocsLayout>
  );
}
