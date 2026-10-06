"use client";
import Link from "next/link";
import { DocsLayout } from "@/components/docs/docs-layout";
import { ArchitectureExplorer } from "@/components/architecture-explorer";
import { getPageNav } from "@/lib/navigation";
import { useI18n } from "@/lib/i18n";
import { VERSION } from "@/lib/release";

export default function Architecture() {
  const { locale } = useI18n();
  const vi = locale === "vi";
  return <DocsLayout breadcrumbs={[{ label: "Docs", href: "/" }, { label: vi ? "Sơ đồ kiến trúc" : "Architecture diagrams" }]} pageNav={getPageNav("architecture")}>
    <p className="doc-eyebrow">GUIDES / v{VERSION}</p>
    <h1>{vi ? "Hiểu hệ thống qua ba sơ đồ." : "Understand the system in three diagrams."}</h1>
    <p className="docs-lead">{vi ? "System diagram mô tả các thành phần. Sequence diagram mô tả trình tự gọi tool. User diagram mô tả công việc của bạn và agent." : "The system diagram maps components. The sequence diagram follows tool calls. The user diagram shows the developer and agent workflow."}</p>
    <p>{vi ? "Đây là luồng graph offline cho TypeScript/JavaScript. Client quyết định gọi tool nào; skill và hướng dẫn MCP hỗ trợ lựa chọn đó." : "These views focus on the offline TypeScript/JavaScript graph path. The client chooses which tools to call; skills and MCP instructions guide that choice."}</p>
    <ArchitectureExplorer locale={locale} showAll />
    <h2 id="boundaries">{vi ? "Ranh giới và độ mới dữ liệu" : "Boundaries and freshness"}</h2>
    <p>{vi ? "SQLite lưu code graph, snapshot và task đã khai báo theo dự án/phiên. workspace_context đọc tài liệu và Git hiện tại; Git không tự suy đoán mục tiêu của bạn." : "SQLite stores the code graph, snapshots and explicitly declared tasks per project/session. workspace_context reads live purpose documents and Git; Git activity does not infer your objective."}</p>
    <p><code>index_code_graph</code> {vi ? "tạo graph/source snapshot; các chunk FTS và vector cần index_codebase riêng. Khi vị trí code bị stale hoặc thiếu, agent phải đọc file hiện tại và refresh index phù hợp." : "creates graph/source snapshots; FTS chunks and vectors require index_codebase separately. Stale or missing locations require current filesystem reads and an appropriate index refresh."}</p>
    <p>{vi ? "Embedding cloud nhận các chunk/query được gửi cho nhà cung cấp. Ollama và Qdrant có thể chạy local. Ngữ cảnh và điều hướng graph không yêu cầu các dịch vụ đó." : "Cloud embeddings receive the chunks/queries sent to that provider. Ollama and Qdrant can run locally. Workspace context and graph navigation do not require those services."}</p>
    <h2 id="codex">{vi ? "Kết nối Codex" : "Connect Codex"}</h2>
    <pre><code>{"cd /your/project\nnpx -y hnindex-cli init --mcp codex\nnpx -y hnindex-cli init-skill --target codex"}</code></pre>
    <p>{vi ? "MCP dùng .codex/config.toml của dự án đã trust; skill tùy chọn nằm trong .agents/skills/use-vibe-hnindex. Khởi động lại hoặc reconnect Codex sau khi cài." : "MCP uses project .codex/config.toml for trusted projects; the optional skill lives in .agents/skills/use-vibe-hnindex. Restart or reconnect Codex after setup."} <Link href="/guides/setup-mcp">{vi ? "Xem cấu hình TOML và cách kiểm tra." : "See TOML configuration and verification."}</Link></p>
    <p><a href="https://github.com/AndyAnh174/vibe-hnindex/blob/main/docs/architecture.md">{vi ? "Source Mermaid chung cho cả hai website" : "Shared Mermaid source for both websites"}</a> · <Link href="/tools/code-graph">Code graph</Link> · <Link href="/tools/workspace">Workspace context</Link></p>
  </DocsLayout>;
}
