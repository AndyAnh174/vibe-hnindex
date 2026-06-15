# MCP search benchmark — vibe-hnindex

- **Thời gian:** 2026-04-08T19:02:34.071Z
- **Ollama:** `http://222.253.80.30:11434`
- **Qdrant:** `http://localhost:6333`
- **Fixture:** `benchmark-fixture/` (index mỗi model vào project `mcpbench_<slug>`, SQLite riêng dưới `C:\Users\ADMIN\AppData\Local\Temp\vibe-hnindex-mcp-bench`)

## Tổng hợp theo model

| Model | index_ms | search_5modes_sum_ms | other_tools_sum_ms |
| --- | --- | --- | --- |
| nomic-embed-text-v2-moe:latest | 525.03 | 729.95 | 1.55 |
| embeddinggemma:300m | 739.26 | 797.71 | 1.84 |
| bge-m3:567m | 618.08 | 723.8 | 1.7 |

- **search_5modes_sum_ms**: tổng thời gian 5 lần gọi `search` (keyword + semantic + hybrid + auto + symbol).
- **other_tools_sum_ms**: `project_stats` + `symbol_lookup` + `list_projects`.

## Chi tiết từng tool (ms) và trạng thái

| Model | Tool | ms | OK | Ghi_chú |
| --- | --- | --- | --- | --- |
| nomic-embed-text-v2-moe:latest | index_codebase | 525.03 | true | chunks=3 qdrant=3 |
| nomic-embed-text-v2-moe:latest | search_keyword | 11.39 | true | Found 2 results for "parseEmbeddingDimensions" (mode: keywor |
| nomic-embed-text-v2-moe:latest | search_semantic | 260.55 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| nomic-embed-text-v2-moe:latest | search_hybrid | 214.65 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| nomic-embed-text-v2-moe:latest | search_auto | 241.72 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| nomic-embed-text-v2-moe:latest | search_symbol | 1.64 | true | Found 1 results for "parseEmbeddingDimensions" (mode: symbol |
| nomic-embed-text-v2-moe:latest | project_stats | 0.68 | true | ## Project: mcpbench_nomic - **Path:** D:\RTIC\MCP\benchmark |
| nomic-embed-text-v2-moe:latest | symbol_lookup | 0.53 | true | ## Symbol lookup: "parseEmbeddingDimensions" **Project:** mc |
| nomic-embed-text-v2-moe:latest | list_projects | 0.34 | true | Found 1 indexed project(s): | Project | Path | Files | Chunk |
| embeddinggemma:300m | index_codebase | 739.26 | true | chunks=3 qdrant=3 |
| embeddinggemma:300m | search_keyword | 11.49 | true | Found 2 results for "parseEmbeddingDimensions" (mode: keywor |
| embeddinggemma:300m | search_semantic | 234.19 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| embeddinggemma:300m | search_hybrid | 287.7 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| embeddinggemma:300m | search_auto | 262.62 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| embeddinggemma:300m | search_symbol | 1.71 | true | Found 1 results for "parseEmbeddingDimensions" (mode: symbol |
| embeddinggemma:300m | project_stats | 0.99 | true | ## Project: mcpbench_gemma - **Path:** D:\RTIC\MCP\benchmark |
| embeddinggemma:300m | symbol_lookup | 0.53 | true | ## Symbol lookup: "parseEmbeddingDimensions" **Project:** mc |
| embeddinggemma:300m | list_projects | 0.32 | true | Found 1 indexed project(s): | Project | Path | Files | Chunk |
| bge-m3:567m | index_codebase | 618.08 | true | chunks=3 qdrant=3 |
| bge-m3:567m | search_keyword | 12.19 | true | Found 2 results for "parseEmbeddingDimensions" (mode: keywor |
| bge-m3:567m | search_semantic | 242.04 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| bge-m3:567m | search_hybrid | 228.47 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| bge-m3:567m | search_auto | 239.41 | true | Found 3 results for "Qdrant Ollama embedding hybrid search p |
| bge-m3:567m | search_symbol | 1.69 | true | Found 1 results for "parseEmbeddingDimensions" (mode: symbol |
| bge-m3:567m | project_stats | 0.74 | true | ## Project: mcpbench_bge - **Path:** D:\RTIC\MCP\benchmark-f |
| bge-m3:567m | symbol_lookup | 0.59 | true | ## Symbol lookup: "parseEmbeddingDimensions" **Project:** mc |
| bge-m3:567m | list_projects | 0.37 | true | Found 1 indexed project(s): | Project | Path | Files | Chunk |

## Ghi chú

- **search_***: cùng query ngữ nghĩa / keyword / symbol như trong `benchmark-model-worker.mjs`.
- **index_codebase**: gồm embed toàn bộ fixture; ms phụ thuộc model + mạng tới Ollama.
- **ok**: `false` nếu tool trả text bắt đầu bằng `Error:` hoặc throw.
- JSON đầy đủ: `benchmark-results/mcp-search-benchmark.json`
