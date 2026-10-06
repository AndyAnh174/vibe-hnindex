"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Braces,
  GitBranch,
  ScanSearch,
  Fingerprint,
  ArrowDown,
  Terminal,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { VERSION } from "@/lib/release";

const copy = {
  en: {
    eyebrow: "PROJECT CONTEXT FOR AI AGENTS",
    title: "Your codebase.",
    highlight: "An open book.",
    subtitle:
      "Give your agent a map of the project, the task at hand, and the exact code it needs. Less searching. More building.",
    start: "Get started",
    docs: "Read the docs",
    release: "What’s new",
    example: "EXAMPLE WORKSPACE",
    objective: "Add session expiration",
    map: "A little context. A lot less guesswork.",
    mapSub: "From a new session to the right place in your code.",
    steps: [
      "Understand the project",
      "Locate the implementation",
      "Follow the connections",
    ],
    desc: [
      "Project purpose, workspace, Git state and a declared objective. Pick up the thread without starting from scratch.",
      "Find files and definitions by name or keyword. Get line evidence and a freshness check before editing.",
      "Inspect callers and references. Add hybrid retrieval when you need to search by concept.",
    ],
    control: "LOCAL FIRST. YOUR CHOICE.",
    controlTitle: "Keep the index close. Choose your embeddings.",
    controlDesc:
      "SQLite holds project context, keyword search and the code graph. For semantic retrieval, use local Ollama or your preferred cloud embedding API.",
    local: "Offline workspace + code locations",
    cloud: "Optional semantic search",
    providerNote:
      "Cloud embedding providers receive the code chunks you send for embedding.",
    setup: "FROM ZERO TO CONTEXT",
    setupTitle: "Make your next session a little smarter.",
    setupDesc:
      "Add the MCP server to your editor. Start with an offline code graph, then add semantic search when you need it.",
    choose: "Choose your editor",
    copied: "Copied",
    copy: "Copy command",
    copyError: "Copy unavailable — select the command manually.",
    setupNote:
      "Node 22+ · Graph indexing supports TypeScript and JavaScript · Embeddings are optional for the offline path.",
    faq: "A few things to know.",
    faqItems: [
      [
        "Do I need an embedding API key?",
        "Workspace context and TypeScript/JavaScript code graph navigation work offline. Semantic and hybrid retrieval need your configured embedding provider and Qdrant.",
      ],
      [
        "Does my code leave my machine?",
        "Workspace context, keyword lookup and the code graph run locally. Ollama can keep embeddings local too. If you choose a cloud provider, the chunks you embed are sent to that provider.",
      ],
      [
        "Will the agent always use hnindex?",
        "MCP startup instructions and the optional editor skill guide the workflow. The client decides which tools to call. Filesystem search remains useful for code that is missing, excluded or stale.",
      ],
      [
        "How does it remember what I’m working on?",
        "The agent declares a task through workspace_context. hnindex stores it in SQLite per project and session. Git state provides evidence of changes, not a guess about your intent.",
      ],
    ],
    latest: "THE PROJECT KEEPS MOVING",
    latestTitle: "Built in the open.",
    latestDesc:
      "Follow the latest improvements to agent context, code navigation and retrieval.",
    latestLink: "Explore the changelog",
    installLabel: "01 / CONNECT",
    indexLabel: "02 / INDEX LOCALLY",
    contextLabel: "03 / START THE TASK",
  },
  vi: {
    eyebrow: "NGỮ CẢNH DỰ ÁN CHO AI AGENT",
    title: "Code của bạn.",
    highlight: "Agent hiểu rõ.",
    subtitle:
      "Cho agent biết dự án đang làm gì, task hiện tại và chính xác code nằm ở đâu. Bớt dò tìm. Tập trung phát triển.",
    start: "Bắt đầu",
    docs: "Đọc tài liệu",
    release: "Có gì mới",
    example: "WORKSPACE MINH HỌA",
    objective: "Thêm thời hạn phiên đăng nhập",
    map: "Đủ ngữ cảnh. Bớt phỏng đoán.",
    mapSub: "Từ phiên làm việc mới đến đúng vị trí cần sửa.",
    steps: ["Hiểu dự án", "Tìm đúng code", "Lần theo các kết nối"],
    desc: [
      "Mục đích dự án, workspace, trạng thái Git và task đã khai báo. Tiếp tục công việc mà không cần tìm hiểu lại từ đầu.",
      "Tìm file và định nghĩa bằng tên hoặc từ khóa. Có vị trí dòng và kiểm tra index còn khớp trước khi sửa.",
      "Xem caller và reference. Thêm tìm kiếm hybrid khi cần tìm theo ý nghĩa.",
    ],
    control: "ƯU TIÊN LOCAL. BẠN LỰA CHỌN.",
    controlTitle: "Index ở gần. Embedding tùy bạn.",
    controlDesc:
      "SQLite lưu ngữ cảnh, tìm kiếm từ khóa và code graph. Khi cần semantic search, dùng Ollama local hoặc API embedding bạn chọn.",
    local: "Workspace + vị trí code chạy offline",
    cloud: "Semantic search tùy chọn",
    providerNote:
      "Nhà cung cấp embedding cloud nhận các đoạn code bạn gửi để embedding.",
    setup: "TỪ CÀI ĐẶT ĐẾN NGỮ CẢNH",
    setupTitle: "Để phiên code tiếp theo thông minh hơn.",
    setupDesc:
      "Cài MCP vào editor. Bắt đầu bằng code graph offline, rồi thêm semantic search khi cần.",
    choose: "Chọn editor",
    copied: "Đã sao chép",
    copy: "Sao chép lệnh",
    copyError: "Không sao chép được — hãy chọn lệnh và sao chép thủ công.",
    setupNote:
      "Node 22+ · Code graph hỗ trợ TypeScript và JavaScript · Luồng offline không cần embedding.",
    faq: "Một vài điều nên biết.",
    faqItems: [
      [
        "Có cần API key embedding không?",
        "Ngữ cảnh workspace và code graph TypeScript/JavaScript chạy offline. Semantic và hybrid retrieval cần nhà cung cấp embedding đã cấu hình cùng Qdrant.",
      ],
      [
        "Code có được gửi ra ngoài không?",
        "Ngữ cảnh, tìm kiếm từ khóa và code graph chạy local. Ollama cũng có thể chạy embedding local. Nếu chọn cloud, các đoạn code cần embedding sẽ được gửi tới nhà cung cấp đó.",
      ],
      [
        "Agent có luôn dùng hnindex không?",
        "Hướng dẫn khởi động MCP và skill editor hướng agent dùng hnindex. Client quyết định gọi tool nào. Vẫn có thể tìm trên filesystem khi code chưa index, bị loại trừ hoặc đã thay đổi.",
      ],
      [
        "Làm sao nhớ được tôi đang làm gì?",
        "Agent khai báo task qua workspace_context. hnindex lưu task trong SQLite theo dự án và phiên. Trạng thái Git cho biết thay đổi, không tự suy đoán ý định.",
      ],
    ],
    latest: "DỰ ÁN LIÊN TỤC PHÁT TRIỂN",
    latestTitle: "Phát triển công khai.",
    latestDesc:
      "Theo dõi cập nhật về ngữ cảnh agent, định vị code và retrieval.",
    latestLink: "Xem changelog",
    installLabel: "01 / KẾT NỐI",
    indexLabel: "02 / INDEX LOCAL",
    contextLabel: "03 / BẮT ĐẦU TASK",
  },
};
const editors = [
  { label: "Claude Code", target: "claude" },
  { label: "Cursor", target: "cursor-project" },
  { label: "VS Code", target: "vscode" },
  { label: "Antigravity", target: "antigravity" },
  { label: "Windsurf", target: "windsurf" },
];

export default function Home() {
  const locale = useLocale(),
    t = copy[locale === "vi" ? "vi" : "en"];
  const [editor, setEditor] = useState("claude"),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false);
  const command =
    "npx -y hnindex-cli init --mcp " +
    editor +
    (["antigravity", "windsurf"].includes(editor)
      ? " --project-root /your/project"
      : "");
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <>
      <section className="hero site-container">
        <div className="hero-copy">
          <Link href="/changelog" className="release-pill">
            <span className="status-dot" />v{VERSION}
            <span className="pill-divider" />
            {t.release}
            <ArrowRight size={13} aria-hidden />
          </Link>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>
            {t.title}
            <br />
            <span>{t.highlight}</span>
          </h1>
          <p className="hero-subtitle">{t.subtitle}</p>
          <div className="hero-actions">
            <a className="button-primary" href="#install">
              {t.start}
              <ArrowRight size={17} aria-hidden />
            </a>
            <a className="button-secondary" href="https://docs.hnindex.cloud">
              {t.docs}
              <ArrowUpRight size={16} aria-hidden />
            </a>
          </div>
          <div className="hero-footnote">
            <span className="tiny-dots">
              <i />
              <i />
              <i />
            </span>
            Claude · Cursor · VS Code · MCP
          </div>
        </div>
        <div className="workspace-preview" aria-label={t.example}>
          <div className="preview-titlebar">
            <span className="window-dots">
              <i />
              <i />
              <i />
            </span>
            <span>~/workspace</span>
            <span className="preview-status">
              <span className="status-dot" />
              index ready
            </span>
          </div>
          <div className="preview-body">
            <div className="preview-section-label">{t.example}</div>
            <div className="context-line">
              <Braces size={16} aria-hidden />
              <code>workspace_context</code>
              <span className="local-tag">local</span>
            </div>
            <div className="context-fields">
              <div>
                <span>project</span>
                <b>acme / api</b>
              </div>
              <div>
                <span>task</span>
                <b>{t.objective}</b>
              </div>
            </div>
            <div className="connector-arrow">
              <ArrowDown size={17} aria-hidden />
            </div>
            <div className="context-line">
              <ScanSearch size={16} aria-hidden />
              <code>locate_code</code>
              <span className="local-tag">local</span>
            </div>
            <div className="code-location">
              <div>
                <span className="location-dot" />
                src/auth/session.ts{" "}
                <span className="fresh-tag">
                  <Check size={11} aria-hidden /> fresh
                </span>
              </div>
              <pre>
                <code>
                  <span className="line-number">24</span>
                  <span className="code-keyword">export function</span>{" "}
                  verifySession(token) {"{"}
                  <br />
                  <span className="line-number">25</span>{" "}
                  <span className="code-keyword">{"return "}</span>token.expiresAt
                  &gt; Date.now();
                  <br />
                  <span className="line-number">26</span>
                  {"}"}
                </code>
              </pre>
            </div>
            <div className="graph-row">
              <GitBranch size={14} aria-hidden />
              <span>handler</span>
              <span className="graph-edge">→ calls →</span>
              <span>verifySession</span>
            </div>
          </div>
          <div className="preview-footer">
            <Fingerprint size={13} aria-hidden />
            <span>source evidence · file freshness · task context</span>
          </div>
        </div>
      </section>
      <div className="integration-strip">
        <div className="site-container">
          <span>BUILT FOR YOUR WORKFLOW</span>
          <div>Claude Code</div>
          <div>Cursor</div>
          <div>VS Code</div>
          <div>Windsurf</div>
          <div>Antigravity</div>
        </div>
      </div>
      <section className="site-container section-space" id="workflow">
        <div className="section-heading">
          <p className="eyebrow">01 / WORKFLOW</p>
          <h2>{t.map}</h2>
          <p>{t.mapSub}</p>
        </div>
        <div className="workflow-columns">
          {[Braces, ScanSearch, GitBranch].map((Icon, i) => (
            <article key={i}>
              <div className="workflow-number">
                0{i + 1}
                <Icon size={20} aria-hidden />
              </div>
              <h3>{t.steps[i]}</h3>
              <p>{t.desc[i]}</p>
              <code>
                {
                  [
                    "workspace_context",
                    "locate_code",
                    "callers · find_references",
                  ][i]
                }
                <ArrowUpRight size={12} aria-hidden />
              </code>
            </article>
          ))}
        </div>
      </section>
      <section className="control-section">
        <div className="site-container control-grid">
          <div>
            <p className="eyebrow">{t.control}</p>
            <h2>{t.controlTitle}</h2>
            <p>{t.controlDesc}</p>
            <a
              className="text-link"
              href="https://docs.hnindex.cloud/configuration"
            >
              {t.docs}
              <ArrowUpRight size={15} aria-hidden />
            </a>
          </div>
          <div className="provider-stack">
            <div className="provider-row">
              <span className="stack-icon">
                <Braces size={20} aria-hidden />
              </span>
              <div>
                <b>SQLite + Code Graph</b>
                <small>{t.local}</small>
              </div>
              <span className="stack-label">LOCAL</span>
            </div>
            <div className="stack-connector" />
            <div className="provider-row">
              <span className="stack-icon">
                <ScanSearch size={20} aria-hidden />
              </span>
              <div>
                <b>{t.cloud}</b>
                <small>Ollama · OpenAI · Voyage · Gemini · compatible</small>
              </div>
            </div>
            <p className="provider-note">{t.providerNote}</p>
          </div>
        </div>
      </section>
      <section
        id="install"
        className="site-container section-space install-grid"
      >
        <div>
          <p className="eyebrow">{t.setup}</p>
          <h2>{t.setupTitle}</h2>
          <p className="section-desc">{t.setupDesc}</p>
          <p className="setup-note">{t.setupNote}</p>
        </div>
        <div className="install-panel">
          <div className="editor-tabs" role="group" aria-label={t.choose}>
            {editors.map((item) => (
              <button
                key={item.target}
                aria-pressed={editor === item.target}
                onClick={() => {
                  setEditor(item.target);
                  setCopied(false);
                  setCopyError(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="install-step">
            <span>{t.installLabel}</span>
            <button
              onClick={copyCommand}
              className="copy-button"
              aria-label={copied ? t.copied : t.copy}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span aria-live="polite">{copied ? t.copied : t.copy}</span>
            </button>
          </div>
          <pre className="install-command">
            <code>
              <span>$ </span>
              {command}
            </code>
          </pre>
          {copyError && (
            <p className="copy-error" role="status">
              {t.copyError}
            </p>
          )}
          <div className="install-step">
            <span>{t.indexLabel}</span>
            <Terminal size={14} aria-hidden />
          </div>
          <pre>
            <code>
              {
                'index_code_graph(\n  path: "/your/project",\n  project_name: "my-app"\n)'
              }
            </code>
          </pre>
          <div className="install-step">
            <span>{t.contextLabel}</span>
          </div>
          <pre>
            <code>
              {
                'workspace_context(project_name: "my-app",\n  task: "Add session expiry")\nlocate_code(project_name: "my-app",\n  symbol: "verifySession")'
              }
            </code>
          </pre>
        </div>
      </section>
      <section className="site-container faq-section">
        <div>
          <p className="eyebrow">02 / FAQ</p>
          <h2>{t.faq}</h2>
        </div>
        <div>
          {t.faqItems.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span aria-hidden>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="site-container release-banner">
        <div>
          <p className="eyebrow">{t.latest}</p>
          <h2>{t.latestTitle}</h2>
          <p>{t.latestDesc}</p>
        </div>
        <Link href="/changelog" className="button-secondary">
          {t.latestLink}
          <ArrowRight size={16} aria-hidden />
        </Link>
      </section>
    </>
  );
}
