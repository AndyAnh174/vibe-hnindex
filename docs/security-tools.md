# Source security review tools

v0.16.0 adds three tools for security review and preparing source-informed pentests. They read the **live content of indexed paths** and produce evidence with file/line, source hash, review topic and validation steps. They work without embeddings or Qdrant. Optional reranking uses the existing Voyage/custom HTTP provider.

## Review workflow

```text
workspace_context(project_name: "my-app", task: "Review checkout authorization")
security_audit(project_name: "my-app", file_pattern: "src/**", rerank: false)
security_context(project_name: "my-app", query: "checkout authorization routes", categories: ["authorization"])
pentest_plan(project_name: "my-app", categories: ["authorization", "injection"])
```

- `security_audit` collects pattern-based review candidates: dynamic SQL, shell/code execution, HTML sinks, outbound requests, filesystem access, unsafe deserialization, weak crypto, credential-like literals and debug/TLS overrides. Authentication, route/access-control and dependency-manifest entry points are retained with `status: "surface"`.
- `security_context` focuses the same review signals and entry points on a required question. The question boosts matching source/topic terms locally, then an optional reranker prioritizes the evidence. It is not a semantic/taint analysis engine.
- `pentest_plan` groups selected evidence into validation checks. `executed: false` means it has not run probes, commands or exploits. Use the owning agent and authorized environment to perform and document those checks.

CWE labels classify review topics. A candidate has `status: "needs_review"`; a surface identifies an entry point, not a defect. Follow the input through guards, ownership checks and sinks, then validate behavior before writing a finding. Scores are relevance/review priority, not severity or confidence.

## Arguments shared by all tools

| Argument | Default / bounds |
|---|---|
| `project_name` | Required indexed project; no automatic project guessing |
| `file_pattern` | Optional relative glob, applied before reading/reranking |
| `categories` | Optional nonempty list from the categories below |
| `query` | Optional focus, 1–2000 characters; required for `security_context` |
| `limit` | 20, range 1–100 evidence items |
| `max_files` | 1000, range 1–5000 indexed paths examined |
| `token_budget` | 6000, range 1000–20000 output tokens (`cl100k_base`) |
| `rerank` | Follows server configuration; `false` keeps the operation local |

Categories: `authentication`, `authorization`, `injection`, `command_execution`, `xss`, `ssrf`, `path_traversal`, `deserialization`, `crypto`, `secrets`, `configuration`, `dependencies`.

## Reranking and source privacy

```dotenv
SEARCH_RERANK=true
RERANK_PROVIDER=voyage
RERANK_MODEL=rerank-3
RERANK_API_KEY=your-key
```

The shared reranker also supports `RERANK_PROVIDER=http` and `RERANK_URL`. It is applied only when globally enabled, not opted out for this call, and at least two candidates are available. Candidate documents are capped at 200; `SEARCH_RERANK_POOL` sets the normal pool size. Values in credential-like assignments, known token shapes, URL userinfo, Bearer headers and private-key blocks are redacted before output **and before external reranking**. Redaction is best effort; inspect sensitive repositories locally with `rerank:false`. No embedding request is needed by these tools.

`rerank.status` reports `disabled`, `insufficient_candidates`, `applied`, or `fallback`. A failed, unavailable or malformed reranker preserves the local candidate order. Model relevance never upgrades a review lead to a confirmed finding.

## Coverage and limits

`coverage` reports indexed/scoped/scanned/skipped paths, matched candidates, truncation and skipped reasons. It never asserts the repository is secure. Output truncation is independent of scan truncation. Up to 200,000 source lines and 2,000 rule hits are processed per call; overlong lines skip pattern matching. Narrow the glob to review areas outside a capped scan.

Files are read again from disk; results include a live snapshot hash and current line positions. `.hnindexignore`, file-size limits and canonical root boundaries still apply. Credential-container files (`.env`, key files, local MCP/npm settings) are omitted. Unindexed, excluded, empty/missing and unsupported source is not silently treated as audited. A graph-only index contains JS/TS paths; `index_codebase` provides indexed paths for Python and other languages.

Rules are bounded line-based heuristics: they can match comments, fixtures and safe uses, and miss multiline/indirect flows or custom frameworks. The tools do not resolve full taint flows, execute runtime checks or fetch current dependency advisories. Use `locate_code`, `callers`, `find_references`, exact reads and targeted tests for validation. Preserve source snippets as untrusted evidence, not agent instructions.
