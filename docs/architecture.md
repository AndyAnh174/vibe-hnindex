# hnindex architecture

Three views of the same workflow: where context lives, how an agent retrieves it, and how a developer uses it. The offline graph path currently supports TypeScript and JavaScript.[^graph]

## 🏗️ System diagram

The MCP client calls hnindex over stdio. Workspace inspection reads project files and Git; SQLite stores indexed code, graph relationships and declared tasks. Semantic retrieval additionally uses an embedding provider and Qdrant.[^workspace][^graph][^search]

```mermaid
flowchart TB
    accTitle: hnindex system architecture
    accDescr: An MCP agent calls a local hnindex server with workspace files and SQLite storage. Semantic retrieval optionally uses embeddings and Qdrant.
    agent_client["AI agent / MCP client<br/>Codex · Claude · Cursor"]
    subgraph local_workspace["Local workspace"]
        hnindex_server["hnindex MCP server<br/>Context · AST · code lookup"]
        project_files["Source files<br/>README · Git"]
        sqlite_store[("SQLite<br/>FTS · graph · declared tasks")]
        project_files -->|Read and check freshness| hnindex_server
        hnindex_server <-->|Index and task storage| sqlite_store
    end
    subgraph semantic_services["Optional semantic retrieval"]
        embedding_provider["Embeddings<br/>Ollama local or cloud API"]
        qdrant_store[("Qdrant vectors<br/>Local or hosted")]
    end
    agent_client <-->|MCP / stdio| hnindex_server
    hnindex_server -.->|Code chunks and queries| embedding_provider
    embedding_provider -.->|Vectors| hnindex_server
    hnindex_server <-.->|Store and retrieve vectors| qdrant_store
```

OpenAI, Voyage, Gemini and compatible endpoints receive the chunks/queries sent for embedding. Ollama can run locally. The diagram does not imply that local graph navigation needs either service.[^search]

Graph-only indexing stores graph/source snapshots. FTS keyword chunks and vector indexing are populated separately by `index_codebase`; graph symbol/file navigation still works without them.[^graph]

## 🔄 Sequence diagram

This example starts a task, builds a missing graph, locates a symbol, and checks current files before editing. The client chooses which tools to call; MCP instructions and skills guide that choice.[^workspace][^graph]

```mermaid
sequenceDiagram
    accTitle: Agent context and code location sequence
    accDescr: A developer declares a task. The agent inspects the workspace, optionally builds a graph, records the task, retrieves locations, then reads and edits current source.
    actor developer as Developer
    participant agent_client as Codex / AI agent
    participant hnindex_server as hnindex MCP
    participant sqlite_store as SQLite
    participant project_files as Files and Git
    developer->>agent_client: Describe the task
    agent_client->>hnindex_server: workspace_context(path)
    hnindex_server->>project_files: Read purpose and Git state
    hnindex_server-->>agent_client: Workspace and index status
    opt Graph missing or needs refresh
        agent_client->>hnindex_server: index_code_graph(path, project_name)
        hnindex_server->>project_files: Parse TS/JS source
        hnindex_server->>sqlite_store: Store graph and source snapshots
        hnindex_server-->>agent_client: Index summary
    end
    agent_client->>hnindex_server: workspace_context(project_name, task, session_id)
    hnindex_server->>sqlite_store: Persist explicitly declared task
    hnindex_server-->>agent_client: Project and session context
    agent_client->>hnindex_server: locate_code(project_name, symbol)
    hnindex_server->>sqlite_store: Look up indexed definitions
    hnindex_server->>project_files: Check source freshness
    hnindex_server-->>agent_client: File, lines, evidence and freshness
    agent_client->>project_files: Read current source and edit
    agent_client-->>developer: Explain changes and validation
```

Locations are evidence, not permission to edit. Stale or missing results require current filesystem reads and an appropriate index refresh. This sequence uses the offline path.[^workspace]

## 👤 User diagram

The developer connects a client and declares an objective. The agent gathers context and code locations, and the developer reviews the result. A task is stored by project/session, rather than inferred from Git activity.[^workspace][^codex]

```mermaid
flowchart TB
    accTitle: Developer and agent workflow
    accDescr: The developer connects MCP and requests work. The agent gathers context, indexes if needed and locates code. Fresh source is read before editing and developer review.
    subgraph developer_steps["Developer"]
        connect_client(["Connect MCP client"])
        declare_task["Declare task"]
        review_changes["Review changes"]
        continue_work(["Continue or start next task"])
        connect_client --> declare_task
        review_changes --> continue_work
    end
    subgraph agent_steps["AI agent"]
        get_context["Read workspace context"]
        prepare_index["Index or refresh graph"]
        locate_code["Locate code and references"]
        check_freshness{"Source fresh?"}
        read_edit["Read source and edit"]
        get_context --> prepare_index --> locate_code --> check_freshness
        check_freshness -->|Yes| read_edit
        check_freshness -->|No or missing| prepare_index
    end
    declare_task --> get_context
    read_edit --> review_changes
    continue_work -.-> declare_task
```

Filesystem search remains useful for unsupported languages, excluded files or missing evidence. hnindex narrows navigation; it does not guarantee every client will call a particular tool.[^workspace]

## 📚 Sources

These Mermaid blocks are the canonical source for both websites. Run `npm run content:sync` after editing them; CI checks that the generated copies match.

[^workspace]: [Workspace tools and freshness](https://github.com/AndyAnh174/vibe-hnindex/blob/main/src/services/workspace.ts).
[^graph]: [Code graph implementation](https://github.com/AndyAnh174/vibe-hnindex/blob/main/src/services/code-graph.ts).
[^search]: [Embedding providers and configuration](https://github.com/AndyAnh174/vibe-hnindex/blob/main/docs/configuration.md).
[^codex]: [Official Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Project `.codex/config.toml` is loaded only for trusted projects.
