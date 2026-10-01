# Workspace and code locations (v0.15.0)

Use this workflow to give a coding agent project context before it searches or edits code. Auto/symbol/keyword location lookup works locally; full vector indexing and explicit hybrid retrieval use configured embedding/Qdrant services.

## Installation and selection

```bash
hnindex init --mcp claude --cwd /absolute/project
# Automatic root binding also applies to cursor-project and vscode.
hnindex init --mcp windsurf --project-root /absolute/project
```

Project-scoped installation sets `HNINDEX_PROJECT_ROOT` to the supplied cwd. Re-running updates that binding. Paths are machine-specific; regenerate configuration after moving a checkout. Global targets (claude-desktop, cursor, antigravity, windsurf) leave root unset unless explicitly configured; omitted flags preserve a previous binding.

Selection order: explicit `project_name`, explicit `path`, `HNINDEX_PROJECT_ROOT`, current client MCP roots, then server cwd **only if it belongs to an indexed project**. Roots are requested on each workspace call so the client can switch projects. Multiple roots or multiple project names for the same root require explicit selection. A child path uses the deepest matching indexed project. When roots/cwd are unavailable, supply a path rather than assuming the first stored project.

## Start a task

```text
workspace_context(path="/absolute/project")
# Initialize locations offline if needed (TypeScript/JavaScript):
index_code_graph(path="/absolute/project", project_name="my-project")
workspace_context(project_name="my-project", task="Add authentication", session_id="agent-1")
```

The response includes purpose with source attribution, bounded live README/manifest/agent-guide excerpts, indexed directory counts, Git branch/HEAD/tracked changes, index readiness and the current declared task. It can read project documents before indexing. Embedding-profile readiness describes stored completion metadata, not live service health. Root files are limited to 64 KiB; ignored paths and symlinks outside the root are excluded.

Tasks are declared by the agent/user; Git changes are evidence, never inferred intent. hnindex does not observe every conversation/edit. SQLite persists tasks per `(project_name, session_id)`, independently of chat-memory vector storage. Use a unique session ID for concurrent agents; the default ID is shared. Call without `task` to recall the objective, or with `clear_task=true` to clear it. Saving requires an indexed project; deletion of a project also deletes its tasks. Session IDs scope state, not access control.

MCP initialization includes startup instructions, and `knowledge://workspace` exposes context for the default session. Clients decide which tools/resources to use; installing MCP cannot force every agent to follow the workflow. `hnindex init-skill --target claude` (or another supported editor) installs the updated guidance.

## Locate before editing

```text
locate_code(query="authenticate")
locate_code(symbol="authenticate", file_pattern="src/auth.ts")
locate_code(query="src/auth.ts")
locate_code(query="jwt validation", mode="keyword")
locate_code(query="how requests authenticate", mode="hybrid")
```

Omit project/path when selection is configured. Auto tries known paths/basenames, definitions, then FTS5 chunks. Symbol mode looks up definitions, keyword searches chunks, and hybrid explicitly opts into configured semantic services/API costs. Graph-only indexing provides TS/JS locations, not FTS/vector chunks. Use `index_codebase` to add keyword/vector coverage for other languages and conceptual queries.

Results include paths, lines, optional symbol/signature, short excerpts and ambiguity. Duplicate names return choices instead of merging relationships. Narrow `file_pattern` or use existing graph tools with `file_path` and definition `line` for same-file ambiguity. Current `.hnindexignore` filters results. Lookup uses up to 100 graph/symbol candidates or 50 keyword hits; `limit` returns at most 20. Keyword/symbol SQL uses its existing SQLite GLOB filter, followed by the final glob check.

| Freshness | Meaning |
|---|---|
| `fresh` | Selected file matches its indexed content/hash |
| `stale` | Current file changed; positions/excerpt refer to the old snapshot |
| `missing_or_excluded` | Missing, ignored, oversized or outside root; excerpt omitted |
| `unverified` | No stored hash to compare |

An unambiguous fresh graph symbol includes bounded CALLS/REFERENCES. Relationship freshness checks use-site and target files; resolution describes the indexed graph. Other resolver-input changes (barrel imports/tsconfig) require graph refresh even when selected endpoints match. Dynamic/external calls may be unresolved. Matching Git HEAD does not establish file freshness.

Refresh graph-only projects with `index_code_graph`; use `index_file`/`index_codebase` for full indexes. Re-locate stale positions before editing. Use `callers`, `find_references`, `graph_context` or `smart_context` for deeper source/impact context. Filesystem reads/search remain available for unindexed, missing, excluded or stale code.

`token_budget` bounds successful JSON output with cl100k_base: workspace default 2500, locator default 2000, range 512–10000. The consuming model's tokenizer can differ. Narrow a query or increase budget when `truncated=true`; location results are bounded index summaries, not exhaustive code listings.
