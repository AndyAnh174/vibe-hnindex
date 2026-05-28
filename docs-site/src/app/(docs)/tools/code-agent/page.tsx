"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

export default function CodeAgentPage() {
  const pageNav = getPageNav("code-agent");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Tools", href: "/tools/search" },
        { label: "Code Agent" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Tools · v0.11.0</Badge>
      <h1>Code Agent</h1>
      <p>
        Code Agent pushes vibe-hnindex from a <strong>search server</strong> to a{" "}
        <strong>coding agent runtime</strong>. Instead of AI assistants calling search
        5-15 times, reading files one by one, and accumulating context noise,
        Code Agent delivers everything needed in <strong>2 calls</strong>.
      </p>

      <div className="not-prose my-6 p-4 rounded-lg border border-border bg-card">
        <p className="text-sm font-semibold mb-2">✨ New in v0.11.0</p>
        <p className="text-sm text-muted-foreground">
          Two new tools: <code>code_session</code> for context gathering and{" "}
          <code>code_apply</code> for safe code changes. Opt-in via{" "}
          <code>CODE_AGENT_ENABLED=true</code> — zero impact on existing workflows.
        </p>
      </div>

      <h2 id="why">Why Code Agent?</h2>
      <p>
        In a typical AI coding session, the assistant wastes 60%+ of its first turn
        just <strong>retrieving context</strong> — multiple searches, reading files,
        filtering noise. This is called <strong>context rot</strong>: irrelevant search
        results accumulating in the context window, degrading reasoning quality.
      </p>

      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <h4 className="text-sm font-bold text-destructive mb-2">Without Code Agent</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>→ search("middleware pattern")</p>
            <p>→ search("express router")</p>
            <p>→ search("rate limit")</p>
            <p>→ read file auth.ts</p>
            <p>→ read file middleware.ts</p>
            <p>→ read file package.json</p>
            <p>→ ... 5-15 calls total</p>
          </div>
          <p className="text-xs text-destructive mt-2">~20K+ context noise</p>
        </Card>
        <Card className="p-4 border-primary/30 bg-primary/5">
          <h4 className="text-sm font-bold text-primary mb-2">With Code Agent</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>→ code_session("add rate limiting")</p>
            <p className="text-muted-foreground/50">... AI reasons over package ...</p>
            <p>→ code_apply(edits=[...])</p>
          </div>
          <p className="text-xs text-primary mt-2">2 calls, ~500 ctx tokens</p>
        </Card>
      </div>

      <Separator className="my-8" />

      <h2 id="code-session">code_session — Context Gathering</h2>
      <p>
        One call that replaces 5-15 separate search + read operations. Returns a
        structured context package with everything the AI needs to reason about a
        code change.
      </p>

      <h3>Usage</h3>
      <pre><code>{`code_session(
  project_name: "my-app",
  task: "add rate limiting middleware to Express API",
  target_files: ["src/api/auth.ts"]  // optional
)`}</code></pre>

      <h3>What It Returns</h3>
      <table>
        <thead>
          <tr><th>Section</th><th>Content</th></tr>
        </thead>
        <tbody>
          <tr><td>Task Analysis</td><td>Detected type (add-feature/refactor/debug/explain), keywords, relevant directories</td></tr>
          <tr><td>Core Files</td><td>Full file contents + exports + imports for the most relevant files</td></tr>
          <tr><td>Similar Patterns</td><td>Files with same extension and structure — follow existing code style</td></tr>
          <tr><td>Dependencies</td><td>Installed packages (from package.json), relevant deps matching task keywords</td></tr>
          <tr><td>Test Files</td><td>Related .test.ts, .spec.ts, __tests__/ files</td></tr>
          <tr><td>Project Structure</td><td>Detected framework (Next.js, Express, React...), test framework, TypeScript</td></tr>
          <tr><td>Impact Analysis</td><td>Files affected by the change + dependents count</td></tr>
        </tbody>
      </table>

      <h3>What Happens Internally</h3>
      <pre><code>{`code_session("add rate limiting", "my-app")
  → detect task type: add-feature
  → smart_context() — analyze impact, find patterns
  → search() keyword × 3 — exact symbol matching
  → search() semantic × 1 — natural language understanding
  → read_file() × N — full content of relevant files
  → dependency_check() — package.json analysis
  → find_test_files() — locate related tests
  → impact_analysis() — who depends on these files?
  → package → return structured JSON`}</code></pre>

      <div className="not-prose my-4 p-3 rounded-lg border border-border bg-muted/50">
        <p className="text-sm">
          <strong>💡 AI Agent Tip:</strong> Call <code>code_session</code> before any
          non-trivial code task. You get 80% of the context you need in one response.
          Then reason over it, decide what to edit, and call <code>code_apply</code>.
        </p>
      </div>

      <Separator className="my-8" />

      <h2 id="code-apply">code_apply — Safe Code Changes</h2>
      <p>
        Apply code changes proposed by the AI. Respects safety scopes, runs tests,
        lint, and typecheck automatically.
      </p>

      <h3>Usage</h3>
      <pre><code>{`code_apply(
  project_name: "my-app",
  session_id: "cs_...",         // from code_session (optional)
  edits: [
    {
      action: "create",
      file_path: "src/middleware/rate-limit.ts",
      content: "import rateLimit from 'express-rate-limit';\\n..."
    },
    {
      action: "modify",
      file_path: "src/api/auth.ts",
      diff: "@@ -1,5 +1,6 @@\\n import express...\\n+import { apiLimiter }..."
    }
  ],
  verify: true                    // run tests after applying (default: true)
)`}</code></pre>

      <h3>Edit Actions</h3>
      <table>
        <thead>
          <tr><th>Action</th><th>Parameters</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>create</code></td><td>file_path + content</td><td>Create a new file (creates parent dirs automatically)</td></tr>
          <tr><td><code>modify</code></td><td>file_path + content or diff</td><td>Update existing file (supports unified diff format)</td></tr>
          <tr><td><code>delete</code></td><td>file_path</td><td>Remove a file</td></tr>
        </tbody>
      </table>

      <Separator className="my-8" />

      <h2 id="safety">Safety Scopes</h2>
      <p>
        Configure via <code>CODE_AGENT_SCOPE</code> env var (default: moderate):
      </p>

      <table>
        <thead>
          <tr><th>Scope</th><th>Safe to Write?</th><th>Restrictions</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>safe</code></td>
            <td>❌ No writes</td>
            <td>Preview-only — great for reviewing before manual edits</td>
          </tr>
          <tr>
            <td><code>moderate</code> (default)</td>
            <td>✅ Create + modify</td>
            <td>Blocks .env, config files, lockfiles, tsconfig, docker-compose</td>
          </tr>
          <tr>
            <td><code>full</code></td>
            <td>✅ Everything</td>
            <td>No restrictions — recommend git backup before use</td>
          </tr>
        </tbody>
      </table>

      <div className="not-prose my-4 p-3 rounded-lg border border-border bg-muted/50">
        <p className="text-sm">
          <strong>🔒 Safety first:</strong> In <code>moderate</code> scope, vibe-hnindex
          refuses to touch .env, package-lock.json, tsconfig.json, docker-compose.yml,
          and other critical config files. Always review changes before committing.
        </p>
      </div>

      <Separator className="my-8" />

      <h2 id="verification">Auto-Verification</h2>
      <p>
        When <code>verify: true</code> (default), <code>code_apply</code> automatically runs:
      </p>
      <ul>
        <li><strong>Tests</strong> — Detects vitest, jest, pytest, or npm test</li>
        <li><strong>Lint</strong> — Runs npm run lint if available</li>
        <li><strong>TypeCheck</strong> — Runs tsc --noEmit for TypeScript projects</li>
      </ul>
      <p>
        If tests fail, the result includes the failure output so the AI can iterate and fix.
      </p>

      <Separator className="my-8" />

      <h2 id="setup">Setup</h2>
      <p>
        Code Agent is <strong>opt-in</strong>. Add these to your MCP config to enable:
      </p>
      <pre><code>{`{
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
}`}</code></pre>

      <p>Or with the CLI (v0.11.1+):</p>
      <pre><code>hnindex init --mcp claude</code></pre>
      <p>
        The CLI automatically includes <code>CODE_AGENT_ENABLED=true</code> and{" "}
        <code>CODE_AGENT_SCOPE=moderate</code> in the generated config.
      </p>

      <Separator className="my-8" />

      <h2 id="best-practices">Best Practices</h2>
      <ol>
        <li>
          <strong>Always start with code_session</strong> — gather context before
          making changes. Avoids blind edits.
        </li>
        <li>
          <strong>Review the context package</strong> — check similar patterns,
          test files, and impact analysis before deciding what to edit.
        </li>
        <li>
          <strong>Use verify=true</strong> (default) — let the server run tests
          and report failures immediately.
        </li>
        <li>
          <strong>Stay in moderate scope</strong> — it provides the best balance
          of safety and capability.
        </li>
        <li>
          <strong>One task per session</strong> — don&apos;t combine multiple unrelated
          changes in one code_apply call.
        </li>
        <li>
          <strong>Commit before applying</strong> — especially in full scope,
          having a git checkpoint makes rollback trivial.
        </li>
      </ol>

      <Separator className="my-8" />

      <h2 id="comparison">Code Agent vs Smart Context</h2>
      <table>
        <thead>
          <tr><th></th><th>smart_context</th><th>code_agent</th></tr>
        </thead>
        <tbody>
          <tr><td>Purpose</td><td>Context for a file/question</td><td>Context + apply changes</td></tr>
          <tr><td>Returns</td><td>Markdown with file info, imports, dependents</td><td>Structured JSON with files, patterns, deps, tests</td></tr>
          <tr><td>Edits</td><td>❌ No</td><td>✅ Create, modify, delete</td></tr>
          <tr><td>Verification</td><td>❌ No</td><td>✅ Tests, lint, typecheck</td></tr>
          <tr><td>Scope control</td><td>N/A</td><td>safe / moderate / full</td></tr>
          <tr><td>Use when</td><td>Understanding code, debugging questions</td><td>Actually making changes, refactoring</td></tr>
        </tbody>
      </table>

      <p>
        Smart Context is great for <strong>exploration</strong>. Code Agent is for{" "}
        <strong>execution</strong>. They complement each other — use smart_context to
        understand, code_agent to implement.
      </p>
    </DocsLayout>
  );
}
