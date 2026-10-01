# Embedding providers (v0.13.0)

Select one embedding provider for the server. Indexing, file watching, semantic/hybrid search and chat memory share that provider; automatic fallback to a different model is intentionally avoided because vector spaces are incompatible.

| `EMBEDDING_PROVIDER` | Default model | Default dimensions | API key |
| --- | --- | --- | --- |
| `ollama` (default) | `bge-m3:567m` | 1024 | Not required |
| `openai` | `text-embedding-3-small` | 1536 | `OPENAI_API_KEY` |
| `voyage` | `voyage-code-3` | 1024 | `VOYAGE_API_KEY` |
| `gemini` | `gemini-embedding-2` | 3072 | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| `openai-compatible` | Set `EMBEDDING_MODEL` | 1024 (override to match model) | Optional `EMBEDDING_API_KEY` or `OPENAI_API_KEY` |

`EMBEDDING_MODEL`, `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY` and `EMBEDDING_DIMENSIONS` override provider defaults. Base URLs must include their API version, have no query/fragment or embedded credentials, and should point to the server API rather than the `/embeddings` route.

Legacy Ollama settings (`OLLAMA_MODEL`, `OLLAMA_URL`, `OLLAMA_TIMEOUT_MS`) continue to work with no new configuration. Generic embedding settings take precedence. Native base URL overrides also support `OPENAI_BASE_URL`, `VOYAGE_BASE_URL` and `GEMINI_BASE_URL`.

## MCP configuration

Use the following block in the MCP configuration for your editor. For development, replace `npx` with `node` and the args with the absolute path to your locally built `dist/index.js`.

```json
{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "EMBEDDING_PROVIDER": "openai",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

Replace the embedding-related env entries with one of these configurations; retain your Qdrant and storage settings:

```json
{ "EMBEDDING_PROVIDER": "voyage", "VOYAGE_API_KEY": "YOUR_VOYAGE_API_KEY" }
```

```json
{ "EMBEDDING_PROVIDER": "gemini", "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY" }
```

```json
{
  "EMBEDDING_PROVIDER": "openai-compatible",
  "EMBEDDING_BASE_URL": "http://localhost:8080/v1",
  "EMBEDDING_MODEL": "your-model-name",
  "EMBEDDING_DIMENSIONS": "768"
}
```

Cloud providers receive the snippets, search queries and enabled chat-memory content being embedded. Use local Ollama or a local compatible endpoint for a fully local setup. Qdrant remains the vector store for every provider.

## CLI setup

```bash
hnindex init --mcp cursor-project --embedding-provider openai
hnindex init --mcp claude --embedding-provider voyage --embedding-model voyage-code-3 --embedding-dimensions 512
hnindex init --mcp vscode --embedding-provider gemini
hnindex init --mcp cursor-project --embedding-provider openai-compatible --embedding-base-url http://localhost:8080/v1 --embedding-model your-model --embedding-dimensions 768
```

Set the provider key in your MCP `env` block, or supply `--embedding-api-key` to write `EMBEDDING_API_KEY`. `--dry-run` prints the full JSON, including keys if supplied. Re-running init without embedding flags preserves those settings. Explicitly changing provider clears inherited generic model, dimensions, endpoint and generic key; supply new values or use the new provider's defaults. Changing the model clears an inherited dimensions override unless you explicitly pass a new size.

## Provider-specific behavior

- **OpenAI:** float vectors are sorted by response index to align with input. Adjustable dimensions are sent for `text-embedding-3*`; legacy and custom model outputs are validated without requesting dimensions.
- **Voyage:** indexed snippets/chat content use `input_type=document`; queries use `input_type=query`. Adjustable model families support `output_dimension`. Fixed-dimension models use their native size, which must match `EMBEDDING_DIMENSIONS`.
- **Gemini:** each text uses its own `embedContent` call to prevent Gemini Embedding 2 from aggregating multiple chunks into one vector. Embedding 2 uses retrieval prefixes; `gemini-embedding-001` uses `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY` task types when selected explicitly. Native responses preserve input ordering. Only text embedding is implemented in this release.
- **Compatible:** expects the OpenAI `/embeddings` contract with indexed float vectors. Azure-specific authentication/deployment URL conventions and vendor-specific bodies need an adapter.

Every provider validates result count, vector dimensions, numeric values and response indices where applicable. HTTP 429/5xx responses retry up to `EMBEDDING_MAX_RETRIES` (default 2); authentication/client errors fail immediately. `EMBEDDING_TIMEOUT_MS` covers the entire individual request, including JSON body loading. Automatic worker concurrency is capped at 4 for non-Ollama providers; use `INDEX_WORKERS=1` for low-quota accounts.

Cloud health checks perform a small real embedding request and may consume quota. Concurrent probes are shared; successful results are cached for 30 seconds and failed results for 5 seconds. Diagnostics show the selected provider and key presence, never the key itself. Provider error bodies are not logged because they may echo input or credentials.

## Changing provider or model

1. Change embedding configuration and restart the MCP server.
2. Run `index_codebase` for the entire project, even if source files are unchanged.
3. Confirm `Ready: yes` and run `server_diagnostics` before semantic search.

The historical default local Ollama collection name is preserved. Other provider/model/dimension/endpoint combinations receive a stable hashed collection suffix, including chat vector collections. API key rotation does not change the collection name.

The project records its active embedding profile in SQLite. A new, changed or incomplete profile forces full embedding; interrupted migrations remain pending for retry. Switching back to a previous profile rebuilds its active code collection so its vector IDs match current SQLite chunk IDs. Other provider collections are retained and can be removed separately when no longer needed. Historical chat vectors are not automatically re-embedded for a new provider; chronological SQLite chat history remains available.

## API references

- [OpenAI embeddings API](https://developers.openai.com/api/reference/resources/embeddings/methods/create)
- [Voyage text embeddings API](https://docs.voyageai.com/reference/embeddings-api)
- [Gemini embedding guide](https://ai.google.dev/gemini-api/docs/embeddings)
- [Gemini embedding API](https://ai.google.dev/api/embeddings)
