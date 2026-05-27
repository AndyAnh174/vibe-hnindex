"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SetupMcpPage() {
  const pageNav = getPageNav("setup-mcp");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides", href: "/guides/setup-mcp" },
        { label: "Setup MCP" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Guides</Badge>
      <h1>Setup MCP</h1>
      <p>
        How to add vibe-hnindex to different AI tools. The MCP configuration is the same
        everywhere — only the file path differs.
      </p>

      <h2 id="config-template">Configuration Template</h2>
      <p>Here&apos;s the standard config block you&apos;ll add to each tool:</p>
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

      <blockquote>
        For Qdrant Cloud, add <code>QDRANT_API_KEY</code> and use your HTTPS cluster URL.
        See the <a href="/getting-started/installation">Installation guide</a> for details.
      </blockquote>

      <Separator className="my-8" />

      <h2 id="per-platform">Per-Platform Setup</h2>

      <Tabs defaultValue="antigravity" className="not-prose my-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="antigravity">Antigravity</TabsTrigger>
          <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
          <TabsTrigger value="claude-desktop">Claude Desktop</TabsTrigger>
          <TabsTrigger value="cursor">Cursor</TabsTrigger>
          <TabsTrigger value="windsurf">Windsurf</TabsTrigger>
          <TabsTrigger value="vscode">VS Code</TabsTrigger>
          <TabsTrigger value="cli">CLI Method</TabsTrigger>
        </TabsList>

        <TabsContent value="antigravity" className="mt-4">
          <h4>Google Antigravity</h4>
          <table>
            <tbody>
              <tr><td><strong>File</strong></td><td><code>mcp_config.json</code></td></tr>
              <tr><td><strong>Windows</strong></td><td><code>C:\Users\&lt;you&gt;\.gemini\antigravity\mcp_config.json</code></td></tr>
              <tr><td><strong>macOS/Linux</strong></td><td><code>~/.gemini/antigravity/mcp_config.json</code></td></tr>
              <tr><td><strong>From UI</strong></td><td>⋮ → MCP → Manage MCP Servers → View raw config</td></tr>
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="claude-code" className="mt-4">
          <h4>Claude Code</h4>
          <p>Create <code>.mcp.json</code> in your project root with the config above.</p>
          <p>Or use the plugin marketplace:</p>
          <pre><code>{`/plugin marketplace add AndyAnh174/vibe-hnindex
/plugin install vibe-hnindex@vibe-hnindex-marketplace`}</code></pre>
        </TabsContent>

        <TabsContent value="claude-desktop" className="mt-4">
          <h4>Claude Desktop</h4>
          <table>
            <tbody>
              <tr><td><strong>Windows</strong></td><td><code>%APPDATA%\Claude\claude_desktop_config.json</code></td></tr>
              <tr><td><strong>macOS</strong></td><td><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></td></tr>
              <tr><td><strong>Linux</strong></td><td><code>~/.config/Claude/claude_desktop_config.json</code></td></tr>
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="cursor" className="mt-4">
          <h4>Cursor</h4>
          <table>
            <tbody>
              <tr><td><strong>Project</strong></td><td><code>.cursor/mcp.json</code></td></tr>
              <tr><td><strong>Global (Windows)</strong></td><td><code>%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json</code></td></tr>
              <tr><td><strong>Global (macOS/Linux)</strong></td><td><code>~/.cursor/mcp.json</code></td></tr>
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="windsurf" className="mt-4">
          <h4>Windsurf</h4>
          <p>File: <code>~/.windsurf/mcp_config.json</code> (same path on all platforms)</p>
        </TabsContent>

        <TabsContent value="vscode" className="mt-4">
          <h4>VS Code (Copilot)</h4>
          <p>File: <code>.vscode/mcp.json</code> in your project root.</p>
          <p>Note: VS Code uses <code>"servers"</code> key instead of <code>"mcpServers"</code>:</p>
          <pre><code>{`{
  "servers": {
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
        </TabsContent>

        <TabsContent value="cli" className="mt-4">
          <h4>CLI Method (Recommended)</h4>
          <p>Skip manual config entirely:</p>
          <pre><code>{`npm install -g hnindex-cli

# Initialize for your editor
hnindex init --mcp antigravity
hnindex init --mcp claude --cwd /path/to/repo
hnindex init --mcp claude-desktop
hnindex init --mcp cursor
hnindex init --mcp cursor-project --cwd /path/to/repo
hnindex init --mcp windsurf
hnindex init --mcp vscode --cwd /path/to/repo

# List all targets
hnindex init --list

# Update CLI
hnindex update`}</code></pre>
          <p>
            The CLI merges into existing files and preserves other MCP servers.
            See <a href="/getting-started/quick-start">Quick Start</a> for all flags.
          </p>
        </TabsContent>
      </Tabs>

      <Separator className="my-8" />

      <h2 id="verify">Verify Your Setup</h2>
      <ol>
        <li>Restart your AI tool after editing the MCP config</li>
        <li>Look for vibe-hnindex in your tool&apos;s MCP server list</li>
        <li>Try indexing a project: <code>Index the codebase at /path, name it test</code></li>
        <li>Run diagnostics: <code>server_diagnostics()</code></li>
      </ol>

      <h2 id="troubleshooting">Common Issues</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose my-4">
        {[
          { issue: "Ollama not reachable", fix: "Ensure ollama serve is running on the configured URL" },
          { issue: "Qdrant auth error (401)", fix: "Set QDRANT_API_KEY for Qdrant Cloud" },
          { issue: "npm install fails (Windows)", fix: "Use Node 20 LTS or install VS Build Tools" },
          { issue: "Server not showing up", fix: "Check file path and JSON syntax; restart tool" },
        ].map((item, i) => (
          <Card key={i} className="p-3">
            <p className="text-sm font-semibold text-destructive">{item.issue}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.fix}</p>
          </Card>
        ))}
      </div>
      <p>
        Full troubleshooting: <a href="/guides/troubleshooting">Troubleshooting Guide</a>
      </p>
    </DocsLayout>
  );
}
