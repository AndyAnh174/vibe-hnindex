"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

export default function ChatMemoryPage() {
  const pageNav = getPageNav("chat-memory");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Tools", href: "/tools/search" },
        { label: "Chat Memory" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Tools · v0.12.0</Badge>
      <h1>Chat Memory</h1>
      <p>
        Chat Memory persists AI agent working context across sessions. When enabled,
        every tool call is automatically logged — <strong>no manual tool call needed</strong>.
        AI restarts sessions with full context from previous work, without re-searching from scratch.
      </p>

      <div className="not-prose my-6 p-4 rounded-lg border border-border bg-card">
        <p className="text-sm font-semibold mb-2">🧠 New in v0.12.0</p>
        <p className="text-sm text-muted-foreground">
          Hybrid storage: <strong>SQLite</strong> (full text) + <strong>Qdrant</strong> (vector embeddings).
          Auto-track via existing tools, semantic search via <code>chat_context</code> tool,
          and auto-load via <code>knowledge://context/{"{project}"}</code> resource.
        </p>
      </div>

      <Separator className="my-8" />

      <h2 id="architecture">Architecture</h2>

      <pre><code>{`SAVE:
  entry → SQLite (sync, always works)
       └→ Ollama embed() → Qdrant (background, fire-and-forget)

LOAD (chronological):
  SQLite → all recent entries by time

LOAD (semantic):
  query → Ollama embed() → Qdrant search(top-K) → SQLite fetch by ID
  → only returns relevant entries, saves tokens`}</code></pre>

      <table>
        <thead>
          <tr><th>Storage</th><th>Role</th><th>Speed</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>SQLite</strong></td><td>Source of truth — full text, chronological queries</td><td>⚡ Instant</td></tr>
          <tr><td><strong>Qdrant</strong></td><td>Acceleration — vector embeddings, semantic search</td><td>🐢 Network round-trip (background)</td></tr>
        </tbody>
      </table>

      <Separator className="my-8" />

      <h2 id="auto-track">Auto-Track</h2>
      <p>
        When <code>CHAT_MEMORY_ENABLED=true</code>, these tools <strong>automatically log</strong> to chat memory.
        The AI agent doesn&apos;t need to call any additional tool.
      </p>

      <table>
        <thead>
          <tr><th>Tool</th><th>What Gets Logged</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>search</code></td>
            <td>Query + mode + top 5 result files + scores</td>
          </tr>
          <tr>
            <td><code>smart_context</code></td>
            <td>Task/question + gathered file paths</td>
          </tr>
          <tr>
            <td><code>code_session</code></td>
            <td>Task + core files + test files + session ID</td>
          </tr>
        </tbody>
      </table>

      <div className="not-prose my-4 p-3 rounded-lg border border-border bg-muted/50">
        <p className="text-sm">
          <strong>💡 Zero friction:</strong> Auto-track means the AI agent just does its job — searches,
          reads context, writes code — and the memory builds up automatically. No manual
          tool calls, no context rot.
        </p>
      </div>

      <Separator className="my-8" />

      <h2 id="chat-context">chat_context Tool</h2>
      <p>
        The <code>chat_context</code> tool provides manual control over chat memory with{" "}
        <strong>5 actions</strong>: save, load, ingest, clear, resource.
      </p>

      <h3>Save — Store a single message</h3>
      <pre><code>{`chat_context(
  action: "save",
  project_name: "my-app",
  role: "assistant",
  content: "Decision: use JWT with refresh tokens for auth flow"
)`}</code></pre>

      <h3>Ingest — Dump full conversation</h3>
      <p>Call once at session end to persist the entire conversation.</p>
      <pre><code>{`chat_context(
  action: "ingest",
  project_name: "my-app",
  title: "Fix login bug — June 2026",
  messages: [
    { role: "user",    content: "fix login bug in auth.ts" },
    { role: "assistant", content: "Found the bug in token validation..." },
    { role: "user",    content: "ok, push it" }
  ]
)`}</code></pre>

      <h3>Load — Retrieve context</h3>

      <p><strong>Chronological load — &quot;what were we working on?&quot;</strong></p>
      <pre><code>{`chat_context(
  action: "load",
  project_name: "my-app",
  limit: 20,           // max entries (default 20)
  max_age_hours: 168   // only within 7 days (default 168)
)`}</code></pre>

      <p><strong>Semantic load — &quot;anything about auth rate limiting?&quot;</strong></p>
      <pre><code>{`chat_context(
  action: "load",
  project_name: "my-app",
  semantic_query: "auth rate limiting middleware",
  limit: 10
)

// Flow: embed query → Qdrant search → SQLite fetch by ID
// Only returns entries semantically similar to the query.
// Falls back to chronological if Ollama/Qdrant are unavailable.`}</code></pre>

      <Separator className="my-8" />

      <h3>Clear — Delete old entries</h3>
      <pre><code>{`chat_context(
  action: "clear",
  project_name: "my-app",
  max_age_hours: 720,       // delete entries older than 30 days
  thread_id: "ct_abc123"    // optional — delete only from this thread
)`}</code></pre>

      <Separator className="my-8" />

      <h2 id="resource">Resource: knowledge://context/{"{project}"}</h2>
      <p>
        AI clients automatically read this MCP resource on session startup.
        No tool call needed — previous context is immediately available.
      </p>
      <pre><code>{`// AI reads: knowledge://context/my-app
// Returns formatted summary:

## Chat Context for "my-app"

### Fix login bug (4 msgs, 1200 chars, updated 2026-06-16)
  👤 User: fix login bug in auth.ts
  🛠 system [tool: search]: [keyword] "auth module" → 5 results
  🤖 AI [tool: smart_context]: task="fix bug" → 3 files
  👤 User: ok, push it`}</code></pre>

      <Separator className="my-8" />

      <h2 id="session-lifecycle">Session Lifecycle</h2>
      <p>Recommended pattern for AI agents using Chat Memory:</p>

      <div className="not-prose my-4 space-y-2">
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <p className="text-sm font-semibold text-emerald-400 mb-1">SESSION START</p>
          <p className="text-xs text-muted-foreground">
            → Resource <code>knowledge://context/my-app</code> auto-loads<br />
            → (Optional) <code>chat_context(action:&quot;load&quot;, limit: 10)</code> for more detail
          </p>
        </div>
        <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
          <p className="text-sm font-semibold text-blue-400 mb-1">DURING SESSION</p>
          <p className="text-xs text-muted-foreground">
            → search / smart_context / code_session → auto-tracked (no action needed)<br />
            → (Optional) <code>chat_context(action:&quot;save&quot;, ...)</code> for important notes
          </p>
        </div>
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-400 mb-1">SESSION END</p>
          <p className="text-xs text-muted-foreground">
            → <code>chat_context(action:&quot;ingest&quot;, messages=[entire conversation])</code><br />
            → (Optional) <code>chat_context(action:&quot;clear&quot;, max_age_hours: 720)</code> for cleanup
          </p>
        </div>
      </div>

      <Separator className="my-8" />

      <h2 id="configuration">Configuration</h2>

      <h3>Env Vars</h3>
      <table>
        <thead>
          <tr><th>Var</th><th>Default</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>CHAT_MEMORY_ENABLED</code></td><td><code>false</code></td><td><strong>Master switch</strong> — must be true</td></tr>
          <tr><td><code>CHAT_MEMORY_VECTOR_ENABLED</code></td><td><code>true</code></td><td>Qdrant vector storage for semantic search</td></tr>
          <tr><td><code>CHAT_MEMORY_LOAD_LIMIT</code></td><td><code>20</code></td><td>Max entries per load</td></tr>
          <tr><td><code>CHAT_MEMORY_MAX_AGE_HOURS</code></td><td><code>168</code></td><td>Only load entries within 7 days</td></tr>
          <tr><td><code>CHAT_MEMORY_THREAD_TTL_MS</code></td><td><code>3600000</code></td><td>Reuse latest thread if within 1 hour</td></tr>
        </tbody>
      </table>

      <h3>Minimal Setup</h3>
      <pre><code>{`# Enable chat memory (SQLite-only — no Qdrant/Ollama needed for memory)
CHAT_MEMORY_ENABLED=true
CHAT_MEMORY_VECTOR_ENABLED=false`}</code></pre>

      <h3>Full Setup (recommended)</h3>
      <pre><code>{`# Enable with semantic search (requires Ollama + Qdrant)
CHAT_MEMORY_ENABLED=true
CHAT_MEMORY_VECTOR_ENABLED=true`}</code></pre>

      <Separator className="my-8" />

      <h2 id="best-practices">Best Practices</h2>
      <ol>
        <li>
          <strong>Ingest at session end</strong> — dump entire conversation once, not after every message.
        </li>
        <li>
          <strong>Use semantic search for specific topics</strong> — when looking for past discussions on a topic, 
          use <code>semantic_query</code> to get only relevant entries.
        </li>
        <li>
          <strong>Use chronological load for resuming</strong> — when resuming a session, use chronological 
          load to see everything in order.
        </li>
        <li>
          <strong>Clear periodically</strong> — clean up entries older than 7-30 days to keep the database lean.
        </li>
        <li>
          <strong>Adjust thread TTL</strong> — set <code>CHAT_MEMORY_THREAD_TTL_MS</code> to match your work 
          patterns (short sessions = lower TTL).
        </li>
        <li>
          <strong>Let auto-track work</strong> — don&apos;t call <code>chat_context</code> during normal work; 
          auto-track handles search and context calls automatically.
        </li>
      </ol>

      <Separator className="my-8" />

      <h2 id="storage">Storage Details</h2>
      <table>
        <thead>
          <tr><th>Detail</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>SQLite tables</td><td><code>chat_threads</code> + <code>chat_context</code> in knowledge.db</td></tr>
          <tr><td>Qdrant collection</td><td><code>mcp_cc_{"{project_name}"}</code></td></tr>
          <tr><td>Vector model</td><td>Same as code embeddings — <code>OLLAMA_MODEL</code></td></tr>
          <tr><td>Embedding timing</td><td>Fire-and-forget (background, doesn&apos;t block response)</td></tr>
          <tr><td>Fallback</td><td>Semantic load falls back to chronological if Ollama/Qdrant are down</td></tr>
        </tbody>
      </table>
    </DocsLayout>
  );
}
