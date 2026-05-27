"use client";

import { DocsLayout } from "@/components/docs/docs-layout";
import { getPageNav } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

const modes = [
  {
    title: "Task Mode",
    desc: "Analyzes impact, finds test files, discovers similar code patterns for a given task.",
    example: 'task: "add rate limiting to the API"',
  },
  {
    title: "Question Mode",
    desc: "Searches relevant code, gathers context imports, dependents, and symbols for understanding.",
    example: 'question: "how does the auth flow work?"',
  },
  {
    title: "Refactor Mode",
    desc: "Full impact analysis depth 3 + all affected files + test files + similar patterns.",
    example: 'task: "refactor the user service"',
  },
];

export default function SmartContextPage() {
  const pageNav = getPageNav("smart-context");

  return (
    <DocsLayout
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Tools", href: "/tools/search" },
        { label: "Smart Context" },
      ]}
      pageNav={pageNav}
    >
      <Badge variant="secondary" className="mb-4">Tools · v0.10.0</Badge>
      <h1>Smart Context</h1>
      <p>
        The <code>smart_context</code> tool automatically gathers relevant code context for AI agents.
        It analyzes your task, question, or refactoring goal and collects the most relevant files,
        symbols, and code patterns.
      </p>

      <div className="not-prose my-6 p-4 rounded-lg border border-border bg-card">
        <p className="text-sm font-semibold mb-2">✨ New in v0.10.0</p>
        <p className="text-sm text-muted-foreground">
          Smart Context now supports 3 modes with auto-detection of task type
          (explain/refactor/debug/add-feature) for optimal context gathering.
        </p>
      </div>

      <h2 id="modes">Modes</h2>
      <div className="not-prose grid grid-cols-1 gap-4 my-6">
        {modes.map((m) => (
          <Card key={m.title} className="p-4">
            <h4 className="text-sm font-bold text-primary mb-1">{m.title}</h4>
            <p className="text-sm text-muted-foreground mb-2">{m.desc}</p>
            <pre><code className="text-xs">{m.example}</code></pre>
          </Card>
        ))}
      </div>

      <h2 id="usage">Usage</h2>

      <h3 id="task-mode">Task Mode</h3>
      <p>
        Provide a task description and let vibe-hnindex gather the relevant context:
      </p>
      <pre><code>{`smart_context(
  project_name: "my-app",
  task: "add rate limiting to the API"
)`}</code></pre>
      <p>The server will:</p>
      <ol>
        <li>Analyze the task for impact scope</li>
        <li>Find relevant test files near affected code</li>
        <li>Discover similar code patterns for consistency</li>
        <li>Auto-detect task type: explain, refactor, debug, or add-feature</li>
      </ol>

      <h3 id="question-mode">Question Mode</h3>
      <p>
        Ask a natural language question about your codebase:
      </p>
      <pre><code>{`smart_context(
  project_name: "my-app",
  question: "how does the auth flow work?"
)`}</code></pre>
      <p>The server will:</p>
      <ol>
        <li>Search code related to your question</li>
        <li>Gather context imports and dependents</li>
        <li>Collect relevant symbols and their definitions</li>
        <li>Provide a comprehensive answer context</li>
      </ol>

      <h3 id="refactor-mode">Refactor Mode</h3>
      <p>
        For full impact analysis when refactoring:
      </p>
      <pre><code>{`smart_context(
  project_name: "my-app",
  task: "refactor the user service"
)`}</code></pre>
      <p>The server will:</p>
      <ol>
        <li>Perform impact analysis up to depth 3</li>
        <li>Find all files affected by the change</li>
        <li>Collect test files for verification</li>
        <li>Discover similar patterns for consistent refactoring</li>
      </ol>

      <Separator className="my-8" />

      <h2 id="auto-detection">Auto-Detection</h2>
      <p>
        The server automatically detects the type of task and adjusts its context gathering strategy:
      </p>
      <table>
        <thead>
          <tr><th>Detected Type</th><th>Context Strategy</th></tr>
        </thead>
        <tbody>
          <tr><td>Explain</td><td>Gather definitions, callers, and documentation</td></tr>
          <tr><td>Refactor</td><td>Deep impact analysis, test files, similar patterns</td></tr>
          <tr><td>Debug</td><td>Error handling, log statements, test coverage</td></tr>
          <tr><td>Add Feature</td><td>Similar implementations, interfaces, patterns</td></tr>
        </tbody>
      </table>

      <h2 id="response-format">Response Format</h2>
      <p>
        Smart Context returns a structured response with sections based on the detected task type:
      </p>

      <table>
        <thead>
          <tr><th>Section</th><th>Content</th><th>Modes</th></tr>
        </thead>
        <tbody>
          <tr><td>Task Analysis</td><td>Detected task type, keywords, relevant directories</td><td>All</td></tr>
          <tr><td>Core Context</td><td>File content + imports + definitions for the main files</td><td>All</td></tr>
          <tr><td>Dependents</td><td>Files that import/use the target code</td><td>Task, Refactor</td></tr>
          <tr><td>Test Files</td><td>Related <code>.test.ts</code>, <code>.spec.ts</code>, <code>__tests__/</code></td><td>Task, Refactor, Debug</td></tr>
          <tr><td>Similar Patterns</td><td>Files with same extension and similar code structure</td><td>Task, Add Feature</td></tr>
          <tr><td>Impact Analysis</td><td>Up to 3 levels deep — files affected by the change</td><td>Refactor</td></tr>
          <tr><td>Symbol Map</td><td>Exports, types, interfaces in the affected scope</td><td>All</td></tr>
          <tr><td>Git History</td><td>Recent changes to relevant files (if git repo)</td><td>All</td></tr>
        </tbody>
      </table>

      <h2 id="agent-usage">How AI Agents Should Use Smart Context</h2>
      <ol>
        <li>
          <strong>Before starting a task:</strong> Call <code>smart_context</code> with a brief
          description of what you plan to do. It gathers all relevant files upfront.
        </li>
        <li>
          <strong>Read the task analysis</strong> to understand the task type and affected areas.
        </li>
        <li>
          <strong>Check impact analysis</strong> (refactor mode) before touching shared utilities
          to avoid breaking dependents.
        </li>
        <li>
          <strong>Review test files</strong> to understand expected behavior and run tests after changes.
        </li>
        <li>
          <strong>Use similar patterns</strong> to stay consistent with existing code style.
        </li>
      </ol>

      <h2 id="related-tools">Related Tools</h2>
      <ul>
        <li>
          <code>project_briefing</code> — Rule-based project briefing (README, package.json, index stats)
        </li>
        <li>
          <code>onboarding_prompt</code> — Single markdown blob with index freshness, briefing, stats
        </li>
        <li>
          <code>agent_rules_stub</code> — Short copy-paste markdown for AI agent context
        </li>
        <li>
          <code>file_summary</code> — Get imports, exports, dependents, and test files for a specific file
        </li>
        <li>
          <code>symbol_lookup</code> — Look up a symbol (function, class, type) and get all references
        </li>
        <li>
          <code>recent_changes</code> — See what files changed recently in a project
        </li>
      </ul>
    </DocsLayout>
  );
}
