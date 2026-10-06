"use client";
import Link from "next/link";
import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
export default function CodeGraph() {
  return (
    <DocsLayout
      breadcrumbs={[{ label: "Docs", href: "/" }, { label: "Code Graph" }]}
      pageNav={getPageNav("code-graph")}
    >
      <p className="doc-eyebrow">TOOLS / SQLITE + TYPESCRIPT AST</p>
      <h1>Follow the connections.</h1>
      <p className="docs-lead">
        A local source graph for TypeScript and JavaScript: definitions,
        imports, references and callers with file/line evidence.
      </p>
      <h2 id="storage">How it works</h2>
      <p>
        hnindex analyzes source using the TypeScript compiler AST and stores
        nodes and relationships in SQLite. There is no separate graph database
        to deploy and no embedding service needed for graph indexing. Indexed
        imports, alias/re-export chains, lexical symbols and typed methods use
        project compiler options.
      </p>
      <h2 id="index">Initialize the graph</h2>
      <pre>
        <code>
          {'index_code_graph(path: "/your/project", project_name: "my-app")'}
        </code>
      </pre>
      <p>
        Full, file and watch indexing can update graph snapshots too. Source
        changes and deletions re-resolve consumers; failed analysis hides stale
        graph data. Graph-only indexing provides TS/JS locations; full codebase
        indexing adds keyword/vector chunks.
      </p>
      <h2 id="tools">Tools to explore</h2>
      <ul>
        <li>
          <code>locate_code</code>: find files or definitions; inspect ambiguity
          and per-file freshness.
        </li>
        <li>
          <code>find_references</code>: inspect source references to a symbol.
        </li>
        <li>
          <code>callers</code>: inspect resolved call relationships.
        </li>
        <li>
          <code>graph_context</code>: request bounded source context around a
          symbol.
        </li>
        <li>
          <code>smart_context</code>: combine retrieval with source
          relationships.
        </li>
      </ul>
      <p>
        Use your MCP client’s tool schema for the exact parameters and project
        filters. Begin with{" "}
        <Link href="/tools/workspace">workspace and code locations</Link> to
        select a project explicitly.
      </p>
      <h2 id="limits">Read the evidence</h2>
      <p>
        The graph currently analyzes TypeScript and JavaScript. Dynamic calls,
        external dependencies and uncertain receiver types can remain
        unresolved. Relationships reflect analyzed source; they do not prove
        runtime behavior. Check freshness before editing and use filesystem
        search for stale, missing or excluded code.
      </p>
    </DocsLayout>
  );
}
