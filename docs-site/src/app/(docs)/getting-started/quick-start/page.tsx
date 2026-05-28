"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function QuickStartPage() {
  const pageNav = getPageNav("quick-start");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Getting Started", href: "/" },
        { label: "Quick Start" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Getting Started</Badge>
      <h1>Quick Start</h1>
      <p>
        Get vibe-hnindex running in 5 minutes. This guide assumes you have Node.js, Ollama, and
        Qdrant installed. If not, see the <a href="/getting-started/installation">Installation guide</a> first.
      </p>

      <h2 id="1-cli-installer">1. Install the CLI Helper</h2>
      <p>The easiest way to set up is with the CLI:</p>
      <pre><code>npm install -g hnindex-cli</code></pre>

      <h2 id="2-init-mcp">2. Initialize MCP Config</h2>
      <p>Pick your editor and run the init command:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose my-4">
        {[
          { cmd: "hnindex init --mcp antigravity", desc: "Google Antigravity" },
          { cmd: "hnindex init --mcp claude", desc: "Claude Code (project)" },
          { cmd: "hnindex init --mcp claude-desktop", desc: "Claude Desktop" },
          { cmd: "hnindex init --mcp cursor", desc: "Cursor (global)" },
          { cmd: "hnindex init --mcp cursor-project", desc: "Cursor (project)" },
          { cmd: "hnindex init --mcp windsurf", desc: "Windsurf" },
          { cmd: "hnindex init --mcp vscode", desc: "VS Code Copilot" },
        ].map((item, i) => (
          <Card key={i} className="p-3">
            <code className="text-xs font-mono block mb-1">{item.cmd}</code>
            <span className="text-xs text-muted-foreground">{item.desc}</span>
          </Card>
        ))}
      </div>

      <p>
        Use <code>--cwd /path/to/project</code> for project-based targets. Add flags for custom config:
      </p>
      <pre><code>{`hnindex init --mcp antigravity \\
  --ollama-url http://localhost:11434 \\
  --ollama-model bge-m3:567m \\
  --qdrant-url http://localhost:6333`}</code></pre>

      <h2 id="3-add-manual-config">3. Or Add Config Manually</h2>
      <p>
        If you prefer manual configuration, add this JSON to your MCP settings file:
      </p>
      <pre><code>{`{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}`}</code></pre>

      <h2 id="4-install-skill">4. Install the Agent Skill (Recommended)</h2>
      <p>
        The vibe-hnindex skill teaches your AI assistant how to use all 20+ tools effectively —
        search modes, streaming, fuzzy matching, benchmarks, and best practices. Without the skill,
        the AI may not know about advanced features like <code>stream: true</code>, fuzzy search, or
        Code Agent.
      </p>

      <pre><code>{`hnindex init-skill --target claude          # Claude Code
hnindex init-skill --target antigravity     # Google Antigravity
hnindex init-skill --target cursor          # Cursor
hnindex init-skill --target windsurf        # Windsurf
hnindex init-skill --target codex           # OpenAI Codex
hnindex init-skill --target vscode          # VS Code
hnindex init-skill --target openclaw        # OpenClaw`}</code></pre>

      <p>
        This creates a <code>SKILL.md</code> file in your editor&apos;s skills directory that the AI
        automatically loads on startup.
      </p>

      <div className="not-prose my-4 p-3 rounded-lg border border-border bg-primary/5">
        <p className="text-sm">
          <strong>💡 Pro tip:</strong> Run <code>hnindex init-skill</code> after updating vibe-hnindex
          to get the latest tool documentation for new features.
        </p>
      </div>

      <h2 id="5-restart">5. Restart Your AI Tool</h2>
      <p>Restart Claude, Cursor, Antigravity, or whatever MCP client you use.</p>

      <h2 id="6-first-index">6. Index Your First Project</h2>
      <p>In your AI chat, type:</p>
      <pre><code>Index the codebase at /path/to/my-project, name it my-project</code></pre>
      <p>
        This calls the <code>index_codebase</code> tool. The first index may take a while
        (embeddings are being generated), but subsequent runs are incremental.
      </p>

      <h2 id="7-search">7. Search Your Code</h2>
      <p>Now you can search:</p>
      <pre><code>{`Search my-project for authentication middleware
Search my-project for "error handling" in mode: semantic
Search my-project for "/TODO|FIXME/g" in mode: regex
List all indexed projects`}</code></pre>

      <h2 id="8-smart-context">8. Try Smart Context</h2>
      <p>
        For complex tasks, use smart context to gather relevant code automatically:
      </p>
      <pre><code>Get smart context for my-project, task: add rate limiting to the API</code></pre>

      <h2 id="whats-next">What&apos;s Next?</h2>
      <ul>
        <li>
          <a href="/configuration">Configure</a> environment variables for custom behavior
        </li>
        <li>
          <a href="/tools/search">Learn about all search modes</a> — keyword, semantic, hybrid, regex, symbol
        </li>
        <li>
          <a href="/tools/index-codebase">Explore indexing options</a> — parallel workers, ignore files, watch mode
        </li>
        <li>
          <a href="/tools/smart-context">Use Smart Context</a> for AI-assisted code understanding
        </li>
      </ul>
    </DocsLayout>
  );
}
