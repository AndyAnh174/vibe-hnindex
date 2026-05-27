"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";

export default function InstallationPage() {
  const pageNav = getPageNav("installation");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Getting Started", href: "/" },
        { label: "Installation" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Getting Started</Badge>
      <h1>Installation</h1>
      <p>
        Follow this guide to install all the required components and get vibe-hnindex running.
      </p>

      <h2 id="prerequisites">Prerequisites</h2>

      <h3 id="nodejs">1. Node.js ≥ 20</h3>
      <p>
        vibe-hnindex requires Node.js 20 or later. Check your version:
      </p>
      <pre><code>node -v</code></pre>
      <p>
        Download from <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">nodejs.org</a> or
        use <a href="https://github.com/coreybutler/nvm-windows" target="_blank" rel="noopener noreferrer">nvm-windows</a>.
      </p>
      <blockquote>
        <strong>Windows users:</strong> Use Node 20 or 22 LTS. Avoid very new versions (e.g., Node 24) if installs
        fail without build tools. See the <a href="/guides/troubleshooting">Troubleshooting guide</a> for details.
      </blockquote>

      <h3 id="ollama">2. Ollama (Embedding Server)</h3>
      <p>
        Ollama provides the embedding model used for semantic search. Install it from{" "}
        <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">ollama.com</a>, then:
      </p>
      <pre><code>ollama pull bge-m3:567m
ollama serve</code></pre>
      <p>
        <strong>Remote Ollama:</strong> If Ollama runs on another machine, you&apos;ll set{" "}
        <code>OLLAMA_URL</code> in your MCP config to point to it.
      </p>

      <h3 id="qdrant">3. Qdrant (Vector Database)</h3>
      <p>
        Qdrant stores vector embeddings for semantic search. It&apos;s optional — keyword search works without it.
      </p>

      <h4>Self-hosted (Docker)</h4>
      <pre><code>{`docker run -d --name qdrant -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant`}</code></pre>

      <h4>Qdrant Cloud</h4>
      <p>
        Sign up at <a href="https://cloud.qdrant.io/" target="_blank" rel="noopener noreferrer">cloud.qdrant.io</a>,
        create a cluster, and get your API key and URL.
      </p>

      <h2 id="npm-install">Install vibe-hnindex</h2>
      <p>You don&apos;t need to install vibe-hnindex globally — it runs via <code>npx</code> in your MCP config.</p>
      <p>However, you can install the CLI helper for easier configuration:</p>
      <pre><code>npm install -g hnindex-cli</code></pre>

      <h2 id="mcp-config">MCP Configuration</h2>
      <p>
        Add vibe-hnindex to your AI tool&apos;s MCP configuration. Here&apos;s a minimal example for
        self-hosted Qdrant:
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

      <h3 id="qdrant-cloud-config">Qdrant Cloud Configuration</h3>
      <p>For Qdrant Cloud, add your API key:</p>
      <pre><code>{`{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "https://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.us-east-1-0.aws.cloud.qdrant.io:6333",
        "QDRANT_API_KEY": "your-qdrant-api-key"
      }
    }
  }
}`}</code></pre>

      <h2 id="verify-installation">Verify Installation</h2>
      <p>Restart your AI tool after adding the MCP config. Then try these commands in chat:</p>
      <pre><code>{`Index the codebase at /path/to/project, name it my-project
Search my-project for authentication middleware
List all indexed projects`}</code></pre>

      <h2 id="next-steps">Next Steps</h2>
      <ul>
        <li>Go through the <a href="/getting-started/quick-start">Quick Start guide</a> for a hands-on walkthrough</li>
        <li>Check out the <a href="/guides/setup-mcp">Setup MCP guide</a> for platform-specific instructions</li>
      </ul>
    </DocsLayout>
  );
}
