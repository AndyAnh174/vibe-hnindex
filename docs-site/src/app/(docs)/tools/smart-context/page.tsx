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
      </ul>
    </DocsLayout>
  );
}
