"use client";
import Link from "next/link";
import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { GRAPH_LANGUAGES, VERSION } from "@/lib/release";
export default function CodeGraph() {
  return (
    <DocsLayout
      breadcrumbs={[{ label: "Docs", href: "/" }, { label: "Code Graph" }]}
      pageNav={getPageNav("code-graph")}
    >
      <p className="doc-eyebrow">TOOLS / SQLITE + MULTILINGUAL AST / v{VERSION}</p>
      <h1>Follow the connections.</h1>
      <p className="docs-lead">
        A local source graph across {GRAPH_LANGUAGES.length} languages: definitions,
        imports, references and callers with file/line evidence.
      </p>
      <h2 id="storage">How it works</h2>
      <p>
        hnindex analyzes JS/TS with the TypeScript compiler and additional languages with bundled Tree-sitter grammars, then stores
        nodes and relationships in SQLite. There is no separate graph database
        to deploy and no embedding service needed for graph indexing. Indexed
        imports, alias/re-export chains, lexical symbols and typed methods use
        project compiler options.
      </p>
      <h2 id="languages">Supported languages</h2>
      <p>{GRAPH_LANGUAGES.join(" · ")}</p>
      <p>Grammar assets are included in the npm dependency and loaded locally. New language profiles provide structural definitions, scoped call/reference evidence and selected explicit imports; they do not claim complete compiler-level type or runtime resolution.</p>
      <h2 id="index">Initialize the graph</h2>
      <pre>
        <code>
          {'index_code_graph(path: "/your/project", project_name: "my-app")'}
        </code>
      </pre>
      <p>
        Full, file and watch indexing can update graph snapshots too. Source
        changes and deletions re-resolve consumers; failed analysis hides stale
        graph data. Graph-only indexing provides supported AST-language locations; full codebase
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
        Re-run <code>index_code_graph</code> after upgrading to include the additional languages. Dynamic calls,
        external dependencies and uncertain receiver types can remain
        unresolved. Relationships reflect analyzed source; they do not prove
        runtime behavior. Check freshness before editing and use filesystem
        search for stale, missing or excluded code.
      </p>
    </DocsLayout>
  );
}
