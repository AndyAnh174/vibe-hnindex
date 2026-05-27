"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function IntroductionPage() {
  const pageNav = getPageNav("introduction");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Getting Started", href: "/getting-started/introduction" },
        { label: "Introduction" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">
        Getting Started
      </Badge>
      <h1>Introduction</h1>
      <p>
        <strong>vibe-hnindex</strong> is a local{" "}
        <a href="https://modelcontextprotocol.io/" target="_blank" rel="noopener noreferrer">
          Model Context Protocol (MCP)
        </a>{" "}
        server that lets AI assistants search your codebase. Index a project once, then search it
        in every AI session — your code stays on your machine.
      </p>

      <h2 id="what-it-does">What It Does</h2>
      <p>
        vibe-hnindex builds a searchable index of your codebase using{" "}
        <strong>SQLite</strong> (for keyword and FTS5 full-text search) and{" "}
        <strong>Qdrant</strong> (for semantic vector search powered by Ollama embeddings).
      </p>
      <p>Once indexed, AI tools can:</p>
      <ul>
        <li>
          <strong>Search</strong> your code by keyword, natural language, or hybrid (both combined)
        </li>
        <li>
          <strong>Find definitions</strong> of functions, classes, and symbols
        </li>
        <li>
          <strong>Use regex</strong> to find patterns across your entire codebase
        </li>
        <li>
          <strong>Get smart context</strong> for tasks, questions, or refactoring
        </li>
        <li>
          <strong>Benchmark</strong> search performance across different modes
        </li>
      </ul>

      <h2 id="key-features">Key Features</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose my-6">
        {[
          { title: "🔍 Multi-Mode Search", desc: "Keyword (FTS5+BM25), semantic (Qdrant vectors), hybrid (RRF fusion), regex, and symbol search." },
          { title: "⚡ Hyper-Speed Indexing", desc: "Single-pass indexing with parallel workers (~30-40% faster since v0.9.1)." },
          { title: "📦 Incremental Updates", desc: "SHA-1 hashing — only re-index changed files." },
          { title: "🔒 100% Local", desc: "Code never leaves your machine. SQLite + Qdrant run locally." },
          { title: "🧠 Smart Context", desc: "Auto-detect task types and gather relevant context for AI agents." },
          { title: "🌐 Streaming Search", desc: "Parallel keyword + semantic search with progress updates." },
        ].map((f, i) => (
          <div key={i} className="rounded-lg border border-border p-4 bg-card">
            <h4 className="text-sm font-semibold mb-1">{f.title}</h4>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      <h2 id="how-it-works">How It Works</h2>
      <ol>
        <li>
          <strong>Index:</strong> You point vibe-hnindex at a directory. It scans files, chunks them (~60 lines),
          embeds chunks via Ollama, and stores everything in SQLite + Qdrant.
        </li>
        <li>
          <strong>Search:</strong> AI assistants call the <code>search</code> tool, which queries the index
          using keyword, semantic, or hybrid modes.
        </li>
        <li>
          <strong>Results:</strong> Ranked code snippets with file paths and line ranges are returned
          to the AI for context.
        </li>
      </ol>

      <h2 id="supported-platforms">Supported Platforms</h2>
      <p>vibe-hnindex works with any MCP-compatible AI tool:</p>
      <div className="flex flex-wrap gap-2 not-prose my-4">
        {[
          "Claude Desktop", "Claude Code", "Cursor", "Windsurf",
          "VS Code Copilot", "Google Antigravity", "Continue.dev",
        ].map((p) => (
          <Badge key={p} variant="outline">{p}</Badge>
        ))}
      </div>

      <h2 id="requirements">Requirements</h2>
      <ul>
        <li><strong>Node.js</strong> ≥ 20 (LTS recommended)</li>
        <li><strong>Ollama</strong> — for embeddings (required for semantic/hybrid search)</li>
        <li><strong>Qdrant</strong> — Docker or Qdrant Cloud (optional; keyword search works without it)</li>
      </ul>

      <Separator className="my-8" />

      <div className="flex items-center gap-4">
        <Link href="/getting-started/installation" className="text-primary font-medium hover:underline">
          Next: Installation →
        </Link>
      </div>
    </DocsLayout>
  );
}
