"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";

export default function WorkspacePage() {
  return (
    <DocsLayout breadcrumbs={[{ label: "Docs", href: "/" }, { label: "Tools", href: "/tools/search" }, { label: "Workspace & Locations" }]} pageNav={getPageNav("workspace")}>
      <Badge variant="secondary" className="mb-4">Tools · v0.15.0</Badge>
      <h1>Workspace &amp; Code Locations</h1>
      <p>Start a coding task with project purpose and the current objective, then locate code with file and line evidence.</p>
      <h2 id="setup">Bind the workspace</h2>
      <pre><code>{`hnindex init --mcp claude --cwd /absolute/project
# Project binding is automatic for claude, cursor-project and vscode.
hnindex init --mcp windsurf --project-root /absolute/project`}</code></pre>
      <p>Project installs set <code>HNINDEX_PROJECT_ROOT</code>. Global installs follow current MCP client roots unless explicitly bound. Selection prefers explicit project/path, configured root, client roots, then an indexed server cwd. Multiple roots require explicit selection. Regenerate machine-specific configuration after moving a checkout.</p>
      <h2 id="start">Start and remember a task</h2>
      <pre><code>{`workspace_context(path: "/absolute/project")
// If not indexed, initialize TS/JS locations offline:
index_code_graph(path: "/absolute/project", project_name: "my-app")
workspace_context(project_name: "my-app", task: "Fix authentication", session_id: "agent-1")`}</code></pre>
      <p><code>workspace_context</code> returns purpose with source attribution, live document excerpts, indexed directories, Git state and index readiness. The task is declared by the user/agent, persisted in SQLite per project/session and recalled when task is omitted. Use distinct session IDs for concurrent agents; the default ID is shared. Clear with <code>clear_task: true</code>. hnindex does not observe every conversation or infer intent from Git.</p>
      <p>MCP initialization instructions and <code>knowledge://workspace</code> expose this workflow. The client decides when to call tools/read resources. Install optional guidance with <code>hnindex init-skill --target claude</code>.</p>
      <h2 id="locate">Locate before editing</h2>
      <pre><code>{`locate_code(query: "authenticate")
locate_code(symbol: "authenticate", file_pattern: "src/auth.ts")
locate_code(query: "src/auth.ts")
locate_code(query: "how requests authenticate", mode: "hybrid")`}</code></pre>
      <p>Auto mode tries files, symbols and local keywords without embeddings. Explicit hybrid mode uses configured semantic services/API costs. Graph-only indexing provides TS/JS locations; use <code>index_codebase</code> for keyword/vector chunks and other languages.</p>
      <p>Results include paths, lines, optional signatures/excerpts, ambiguous definitions and nearby CALLS/REFERENCES. A file pattern narrows definitions; related use sites can appear in other files.</p>
      <h2 id="freshness">Verify freshness</h2>
      <ul>
        <li><code>fresh</code>: selected file matches indexed contents.</li>
        <li><code>stale</code>: file changed; returned positions refer to the previous snapshot.</li>
        <li><code>missing_or_excluded</code>: missing, ignored, oversized or outside root; no excerpt.</li>
        <li><code>unverified</code>: no stored hash to compare.</li>
      </ul>
      <p>Relationship freshness checks use-site/target files. Resolution describes the indexed graph; changes to barrel imports or tsconfig require graph refresh. Dynamic/external calls may be unresolved. Use <code>index_code_graph</code> for graph-only projects or <code>index_file</code>/<code>index_codebase</code> for full indexes, then re-locate before editing stale positions.</p>
      <p>Use callers/find_references or smart_context for deeper context. Filesystem reads/search remain available for unavailable, stale or excluded code. Output is bounded by a cl100k_base token budget (workspace default 2500, locator 2000); narrow the query when truncated.</p>
      <p><a href="https://github.com/AndyAnh174/vibe-hnindex/blob/main/docs/workspace.md">Full workspace reference</a></p>
    </DocsLayout>
  );
}
