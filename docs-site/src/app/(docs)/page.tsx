"use client";
import Link from "next/link";
import {
  Braces,
  ScanSearch,
  GitBranch,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { DocsLayout } from "@/components/docs/docs-layout";
import { useI18n } from "@/lib/i18n";
import { VERSION } from "@/lib/release";
import { getPageNav } from "@/lib/navigation";
export default function Introduction() {
  const vi = useI18n().locale === "vi";
  const cards = [
    {
      href: "/tools/workspace",
      Icon: Braces,
      title: vi ? "Hiểu workspace" : "Know the workspace",
      desc: vi
        ? "Mục đích dự án, Git và task đã khai báo trong SQLite."
        : "Project purpose, live Git state and a declared task stored in SQLite.",
    },
    {
      href: "/tools/workspace#locate",
      Icon: ScanSearch,
      title: vi ? "Tìm đúng vị trí" : "Find the right location",
      desc: vi
        ? "File, symbol, dòng code và độ mới của index."
        : "Files, symbols, line evidence and index freshness before editing.",
    },
    {
      href: "/tools/code-graph",
      Icon: GitBranch,
      title: vi ? "Đi theo code graph" : "Follow the code graph",
      desc: vi
        ? "AST TypeScript/JavaScript với caller và reference."
        : "TypeScript/JavaScript AST relationships, callers and references.",
    },
    {
      href: "/configuration",
      Icon: SlidersHorizontal,
      title: vi ? "Chọn embedding" : "Choose your embeddings",
      desc: vi
        ? "Ollama, OpenAI, Voyage, Gemini và API tương thích."
        : "Ollama, OpenAI, Voyage, Gemini and compatible APIs.",
    },
  ];
  return (
    <DocsLayout pageNav={getPageNav("introduction")}>
      <p className="doc-eyebrow">DOCUMENTATION / v{VERSION}</p>
      <h1 className="docs-home-title">
        {vi ? "Dự án rõ ràng." : "A clearer project."}
        <br />
        <span>{vi ? "Agent sẵn sàng." : "A ready agent."}</span>
      </h1>
      <p className="docs-lead">
        {vi
          ? "hnindex cho AI agent ngữ cảnh của dự án và vị trí code có bằng chứng. Bắt đầu local, thêm semantic retrieval khi cần."
          : "hnindex gives your AI agent project context and code locations backed by source evidence. Start locally; add semantic retrieval when you need it."}
      </p>
      <div className="docs-action-row">
        <Link
          className="docs-action-primary"
          href="/getting-started/quick-start"
        >
          {vi ? "Bắt đầu" : "Quick start"}
          <ArrowRight size={15} aria-hidden />
        </Link>
        <Link href="/changelog">
          {vi ? "Có gì mới" : "What’s new"}
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <div className="docs-flow">
        <div>
          <small>01</small>
          <b>{vi ? "Hiểu dự án" : "Orient"}</b>
          <code>workspace_context</code>
        </div>
        <div>
          <small>02</small>
          <b>{vi ? "Tìm code" : "Locate"}</b>
          <code>locate_code</code>
        </div>
        <div>
          <small>03</small>
          <b>{vi ? "Xem liên kết" : "Connect"}</b>
          <code>graph_context</code>
        </div>
      </div>
      <h2 id="explore">
        {vi ? "Bắt đầu từ điều bạn cần" : "Start with what you need"}
      </h2>
      <div className="docs-guide-grid">
        {cards.map(({ href, Icon, title, desc }) => (
          <Link href={href} className="docs-guide-card" key={href}>
            <Icon size={23} aria-hidden />
            <h3>{title}</h3>
            <p>{desc}</p>
            <span>
              {vi ? "Đọc hướng dẫn" : "Explore guide"}
              <ArrowRight size={12} aria-hidden />
            </span>
          </Link>
        ))}
      </div>
      <h2 id="first-session">
        {vi ? "Phiên làm việc đầu tiên" : "Your first session"}
      </h2>
      <p>
        {vi
          ? "Chạy từ thư mục dự án. Node 22+ là đủ cho luồng code graph offline TypeScript/JavaScript."
          : "Run this from your project directory. Node 22+ is enough for the offline TypeScript/JavaScript graph workflow."}
      </p>
      <pre>
        <code>
          {
            'npx -y hnindex-cli init --mcp claude\n\n// Ask your MCP agent to run:\nindex_code_graph(path: "/your/project", project_name: "my-app")\nworkspace_context(project_name: "my-app", task: "Add session expiry")\nlocate_code(project_name: "my-app", symbol: "verifySession")'
          }
        </code>
      </pre>
      <div className="docs-note">
        <strong>
          {vi ? "Local trước, cloud tùy chọn." : "Local first. Cloud optional."}
        </strong>
        <p>
          {vi
            ? "Workspace, task và code graph nằm trong SQLite. Semantic/hybrid search cần Qdrant và nhà cung cấp embedding. Nếu chọn cloud, các đoạn code embedding sẽ được gửi tới nhà cung cấp."
            : "Workspace context, tasks and the code graph live in SQLite. Semantic/hybrid search needs Qdrant and an embedding provider. Cloud providers receive the code chunks you choose to embed."}
        </p>
      </div>
      <h2 id="evidence">
        {vi ? "Ngữ cảnh có bằng chứng" : "Context with evidence"}
      </h2>
      <p>
        {vi
          ? "Task được agent khai báo, không tự suy đoán từ Git. Code graph hiện hỗ trợ TS/JS; dynamic call và dependency bên ngoài có thể chưa resolve. Luôn kiểm tra freshness trước khi sửa, và dùng filesystem khi code chưa index hoặc đã cũ."
          : "Tasks are declared by the agent, rather than inferred from Git. The code graph currently supports TS/JS; dynamic calls and external dependencies can remain unresolved. Check freshness before editing and use filesystem search for missing, excluded or stale code."}
      </p>
    </DocsLayout>
  );
}
