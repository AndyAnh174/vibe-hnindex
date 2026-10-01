# Code Graph (v0.14.0)

Code Graph augments hybrid retrieval with static relationships from indexed TypeScript/JavaScript source. Graph nodes, edges and source snapshots live in SQLite. Qdrant remains the vector backend; no Neo4j service is required.

## Start offline

```text
index_code_graph(path="/absolute/repository", project_name="app")
find_references(project_name="app", symbol="authenticate", file_path="src/auth.ts")
callers(project_name="app", symbol="authenticate", file_path="src/auth.ts")
graph_context(project_name="app", symbol="authenticate", file_path="src/auth.ts",
              depth=2, direction="incoming", token_budget=4000)
```

`index_code_graph` does not call embedding or vector APIs. It honors scanner exclusions, size limits and `.hnindexignore`. It creates a project if necessary, but does not build keyword/vector chunks or start watching. Re-run it after source/config changes, or use `index_codebase` and `watch_project` once embeddings are configured.

`index_codebase` builds the graph as part of a normal index. `index_file` and watchers update snapshots and rebuild project-wide resolution, including unchanged consumers. Both full graph/index scans remove deleted/excluded graph sources. Failed analysis invalidates graph readiness so tools cannot return old edges. `delete_project` removes graph data.

## Relationships and evidence

File and symbol nodes carry declaration kind, signature, parent and source span. Edges are `DEFINES`, `IMPORTS`, `REFERENCES`, and `CALLS`, with source file, line, column, target and resolution status. Reference/caller tools return resolved sites and report ambiguous names; supply `file_path` and the definition's start `line` to disambiguate overloads or nested declarations.

Resolution uses a TypeScript compiler program populated from indexed snapshots only. Project-root `tsconfig.json` or `jsconfig.json`, including compiler paths and inherited options, configure resolution. Imports through `.js` paths to TS source, aliases, barrels, default/namespace imports and typed methods are supported when the compiler resolves them. External package source and ignored/unindexed files do not enter the graph.

This is static analysis, not runtime tracing. Dynamic calls, callbacks without a known binding, reflection and external declarations can remain unresolved. Syntax diagnostics are reported. The graph does not certify that source type-checks. Other languages retain existing indexing and file dependency behavior. Whole-project resolution is rebuilt after source/options changes; fingerprinting skips unchanged full scans. For very large projects this adds CPU/memory cost; disable graph analysis with `CODE_GRAPH_ENABLED=false` if necessary.

## Context and budgets

`graph_context` accepts an exact `symbol`, a `file_path`, or a `query`. Query mode seeds from hybrid search, so it needs keyword/vector chunks matching the graph source snapshots; it can call configured embedding/rerank APIs. Outdated chunk seeds are skipped, with a rebuild instruction if none remain. Exact file/symbol mode works offline. `direction` is `incoming`, `outgoing`, or `both`; `depth` is 0–3. Traversal caps nodes (default 40, max 100), edges (200) and work between/within traversal steps, reporting truncation.

Context includes source-site evidence and declaration excerpts (up to 80 lines each). It is packed under `token_budget` (256–20000, default 4000), measured using **cl100k_base**. The consuming model may use a different tokenizer. If a query is supplied, configured reranking can reorder excerpt candidates. `smart_context` adds a bounded symbol relationship section for graph-ready files.

## AST chunks and migration

v0.14.0 requires Node 22 or later. The SQLite driver uses bundled N-API binaries; CI verifies Node 22 and 24.

TS/JS large files split along declarations, including leading comments; oversized functions/classes still have a line cap. AST chunks do not overlap. Small files stay single chunks. Invalid syntax and other file types use existing line chunking. Stored chunk text remains source text with exact line spans; embedding inputs add file/line metadata for TS/JS.

After upgrading from v0.13.0, restart MCP and run a full `index_codebase` once. The changed chunk profile forces re-embedding, which can incur provider cost. Changing `AST_CHUNKING`, `CHUNK_SIZE`, or `CHUNK_OVERLAP` requires the same rebuild. Graph-only usage needs `index_code_graph` instead and has no embedding charge.

## Reranking and quality evaluation

```text
RERANK_PROVIDER=voyage
RERANK_MODEL=rerank-3-lite
VOYAGE_API_KEY=...
```

Alternatively use `RERANK_PROVIDER=http`, `RERANK_URL` and optional `RERANK_API_KEY`. No configured reranker, missing key, invalid scores, timeout or HTTP failure preserves retrieval order. Symbol/regex search skips reranking. Hybrid ranking keeps a wider candidate pool until rerank, then trims to `limit`; cache entries contain final ranked results and include ranking/dedupe/fuzzy/path options.

```text
evaluate_retrieval(project_name="app", k=5, cases=[
  {query:"authenticate", mode:"symbol", expected_files:["src/auth.ts"]},
  {query:"authentication middleware", mode:"hybrid", expected_files:["src/auth.ts","src/middleware.ts"]}
])
```

The evaluator accepts 1–100 labeled cases and reports file-level Recall@K, MRR, binary nDCG, p95 latency and output tokens. It bypasses cache and lists failed cases; quality averages exclude failures. It performs one run per case, so p95 is descriptive, not a controlled performance claim. Hybrid/semantic evaluation uses configured services and can incur API charges. Static relationship accuracy is tested separately with alias/shadowing/deletion fixtures.

Run the included offline corpus comparison after building:

```sh
npm run bench:quality
```

The corpus mixes exact identifiers, paths and descriptive keyword queries on this repository. It evaluates file retrieval, not complete answer quality or cloud embedding quality.

## CLI

```sh
hnindex init --mcp claude --code-graph true --ast-chunking true --rerank-provider voyage
```

Optional flags: `--rerank-model`, `--rerank-url`, `--rerank-api-key`. Omitted graph/rerank flags preserve saved settings. Changing rerank provider clears stale model, endpoint and generic rerank credential; other embedding settings remain intact. Prefer setting keys directly in the MCP environment rather than pasting secrets into shell history.
