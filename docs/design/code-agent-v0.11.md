# Code Agent — Thiết kế v0.11.0 (v2)
## vibe-hnindex là "tay chân", AI assistant là "não"

---

## Nguyên lý

**KHÔNG chạy LLM trong vibe-hnindex.** vibe-hnindex là search + execution server.
AI assistant bên ngoài (Claude, DeepSeek, Gemini...) làm reasoning engine.

```
┌──────────────────────────────────────────────────────┐
│  AI Assistant (LLM mạnh — Claude/DeepSeek/Gemini)     │
│                                                       │
│  Bước 1: code_session("task", "project")              │
│      → Nhận context package (files, patterns, impact) │
│      → Tự reasoning: cần sửa gì, ở đâu                │
│                                                       │
│  Bước 2: code_apply({ edits: [...] })                 │
│      → vibe-hnindex apply diff + run test             │
│      → Nhận kết quả                                   │
└────────────────────┬─────────────────────────────────┘
                     │ MCP Protocol
┌────────────────────▼─────────────────────────────────┐
│  vibe-hnindex (execution only)                       │
│                                                       │
│  code_session()          code_apply()                 │
│  ├─ smart_context        ├─ write files              │
│  ├─ search (multi-mode)  ├─ run tests                │
│  ├─ dependency graph     ├─ git diff                 │
│  └─ test file finder     └─ lint/typecheck            │
└──────────────────────────────────────────────────────┘
```

---

## 2. Feature Flag — Bật/Tắt

```bash
# Trong MCP config env
CODE_AGENT_ENABLED=true     # Bật sub-agent tools (mặc định: false)
CODE_AGENT_SCOPE=moderate   # safe | moderate | full
```

Khi `CODE_AGENT_ENABLED=false` (mặc định): vibe-hnindex hoạt động như cũ — chỉ search + index, không có tool code_session/code_apply.

Người dùng tự chọn bật khi muốn dùng. Không ảnh hưởng đến người chỉ cần search.

---

## 3. Tool 1: `code_session`

**Mục đích:** Chuẩn bị toàn bộ context cần thiết cho AI làm 1 task code.
Trả về structured package để AI reasoning.

```typescript
code_session({
  project_name: "my-app",
  task: "add rate limiting middleware to Express API",

  // Optional
  target_files: ["src/api/auth.ts"],   // Nếu biết file cụ thể
  scope: "moderate",                    // safe | moderate | full
})
```

**Response — Structured Context Package:**

```json
{
  "session_id": "cs_20260528_001",
  "task_analysis": {
    "detected_type": "add-feature",
    "keywords": ["rate", "limit", "middleware", "express"],
    "relevant_dirs": ["src/api/", "src/middleware/"]
  },
  "core_files": [
    {
      "path": "src/api/auth.ts",
      "content": "import express from 'express';\nconst router = express.Router();\n...",
      "language": "typescript",
      "exports": ["authRouter"],
      "imports": ["express", "jsonwebtoken"]
    }
  ],
  "similar_patterns": [
    {
      "path": "src/middleware/auth.ts",
      "snippet": "export function authMiddleware(req, res, next) { ... }",
      "relevance": "high",
      "note": "Existing middleware pattern to follow"
    }
  ],
  "dependencies": {
    "installed": ["express@4.18.2", "express-rate-limit@7.1.4"],
    "relevant": "express-rate-limit đã có trong package.json"
  },
  "test_files": [
    "src/api/__tests__/auth.test.ts",
    "src/middleware/__tests__/auth.test.ts"
  ],
  "project_structure": {
    "framework": "Express.js",
    "test_framework": "vitest",
    "typescript": true
  },
  "session_data": {
    "collected_files": 5,
    "total_context_tokens": 3200,
    "cached_for": "5 minutes"
  }
}
```

**Flow bên trong:**

```
code_session(task, project)
  → smart_context() — auto-detect task type + keywords
  → search() — multi-mode: keyword + semantic + hybrid
  → find_test_files() — tìm test liên quan
  → find_similar_patterns() — middleware/auth patterns
  → dependency_check() — package.json analysis
  → package → trả về structured context
```

---

## 4. Tool 2: `code_apply`

**Mục đích:** Apply thay đổi code mà AI đã quyết định.

```typescript
code_apply({
  session_id: "cs_20260528_001",    // Từ code_session trước
  project_name: "my-app",
  edits: [
    {
      action: "create",
      file_path: "src/middleware/rate-limit.ts",
      content: "import rateLimit from 'express-rate-limit';\n\nexport const apiLimiter = rateLimit({\n  windowMs: 60000,\n  max: 5,\n  message: 'Too many requests'\n});"
    },
    {
      action: "modify",
      file_path: "src/api/auth.ts",
      diff: "@@ -1,5 +1,6 @@\n import express from 'express';\n+import { apiLimiter } from '../middleware/rate-limit';\n const router = express.Router();\n+router.use(apiLimiter);"
    }
  ],
  verify: true    // Run tests after applying
})
```

**Response:**

```json
{
  "status": "applied",
  "changes": [
    { "file": "src/middleware/rate-limit.ts", "action": "created", "lines": 8 },
    { "file": "src/api/auth.ts", "action": "modified", "lines_added": 2 }
  ],
  "verification": {
    "tests": { "passed": 14, "failed": 0, "total": 14 },
    "lint": "clean",
    "typecheck": "0 errors"
  },
  "diff_summary": "+10 lines across 2 files",
  "recommendation": "All checks passed. Safe to commit."
}
```

**Safety checks khi apply:**

| Scope | Được phép |
|---|---|
| `safe` | ❌ Không ghi gì — chỉ preview diff |
| `moderate` | ✅ Tạo file mới, sửa file non-critical. ❌ Không sửa config/env/test |
| `full` | ✅ Toàn quyền — recommend git backup trước |

---

## 5. AI Assistant Flow Đầy Đủ

### Ví dụ: "Add rate limiting to Express API"

```
USER: Add rate limiting to the Express API

AI (Claude/DeepSeek):
  Bước 1 — Gọi code_session:
    "Tôi cần hiểu codebase trước khi thêm rate limiting..."

  → vibe-hnindex trả về context package:
    - src/api/auth.ts (có router Express)
    - src/middleware/auth.ts (middleware pattern hiện có)
    - package.json (đã có express-rate-limit!)
    - test files auth.test.ts

AI reasoning:
    "OK, express-rate-limit đã có trong deps.
     Pattern middleware là function export.
     Tôi sẽ tạo src/middleware/rate-limit.ts
     và import vào auth.ts."

  Bước 2 — Gọi code_apply:
    edit 1: tạo src/middleware/rate-limit.ts
    edit 2: sửa src/api/auth.ts (import + use)

  → vibe-hnindex apply + test → 14/14 passed ✅

AI trả lời user:
    "Đã thêm rate limiting. Tạo middleware/rate-limit.ts (5 req/phút/IP)
     và áp dụng cho auth router. 14 tests pass."
```

--- So với cách cũ: AI gọi search 5-7 lần → đọc từng file → tự viết code → context rot 20K+ tokens ---

## 6. So sánh Với Cách Cũ

| | Cách cũ (search manually) | Code Agent |
|---|---|---|
| Tool calls | 5-15 lần | 2 lần |
| Context tokens wasted | ~20,000+ | ~500 |
| AI phải tự đọc file? | Có, từng file | Không, nhận package |
| Code style nhất quán? | Tùy AI | Có (similar patterns) |
| Test tự động chạy? | Không | Có |
| Bật/tắt được? | N/A | ✅ CODE_AGENT_ENABLED |

---

## 7. Implementation Plan

### Phase 1: Core (v0.11.0)

- [ ] Feature flag `CODE_AGENT_ENABLED`
- [ ] Tool `code_session`:
  - Tích hợp smart_context + multi-mode search
  - Similar pattern detection
  - Dependency check (package.json)
  - Test file finder
- [ ] Tool `code_apply`:
  - File create/modify với scope check
  - Auto-run test suite
  - Diff preview

### Phase 2: Advanced (v0.11.1)

- [ ] Session caching — tái dùng context trong 5 phút
- [ ] Multi-file refactor — dependency graph để sort edit order
- [ ] Lint/typecheck integration
- [ ] Git auto-backup trước khi apply

### Phase 3: Autonomous (v0.12.0)

- [ ] Auto-iterate: code_session → propose → code_apply → verify → loop nếu fail
- [ ] Agent memory: học từ session trước
- [ ] Rollback nếu test fail

---

## 8. Migration Path

Người dùng hiện tại **không bị ảnh hưởng** — mặc định `CODE_AGENT_ENABLED=false`.
Muốn dùng thì thêm 1 dòng env:

```json
{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "http://localhost:6333",
        "CODE_AGENT_ENABLED": "true",
        "CODE_AGENT_SCOPE": "moderate"
      }
    }
  }
}
```
