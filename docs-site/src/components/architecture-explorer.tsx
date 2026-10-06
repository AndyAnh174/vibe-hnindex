"use client";
import { useState } from "react";
import diagrams from "@/lib/architecture.generated.json";
import { MermaidDiagram } from "@/components/mermaid-diagram";
const copy = {
  en: {
    choose: "Choose a diagram", pan: "Scroll inside the diagram on smaller screens.",
    system: ["System diagram", "Where the context lives.", "MCP connects your agent to local files and SQLite. Embeddings and Qdrant extend the system when you need semantic retrieval."],
    sequence: ["Sequence diagram", "From a task to source evidence.", "The agent checks the workspace, records your declared task, then locates code with line evidence and a freshness check before editing."],
    user: ["User diagram", "Your request. The agent’s workflow.", "Connect your client, declare the objective, let the agent gather context and inspect code, then review the changes."],
  },
  vi: {
    choose: "Chọn sơ đồ", pan: "Có thể cuộn bên trong sơ đồ trên màn hình nhỏ.",
    system: ["System diagram", "Ngữ cảnh nằm ở đâu.", "MCP nối agent với file và SQLite local. Embedding và Qdrant mở rộng hệ thống khi bạn cần tìm kiếm semantic."],
    sequence: ["Sequence diagram", "Từ task đến bằng chứng code.", "Agent kiểm tra workspace, lưu task bạn khai báo, rồi định vị code với dòng nguồn và kiểm tra độ mới trước khi sửa."],
    user: ["User diagram", "Bạn yêu cầu. Agent thực hiện.", "Kết nối client, khai báo mục tiêu, để agent lấy ngữ cảnh và đọc code, rồi xem lại thay đổi."],
  },
};
export function ArchitectureExplorer({ locale = "en", showAll = false }: { locale?: string; showAll?: boolean }) {
  const [selected, setSelected] = useState("system");
  const t = copy[locale === "vi" ? "vi" : "en"];
  return <div className="architecture-explorer">
    {!showAll && <div className="diagram-tabs" role="group" aria-label={t.choose}>
      {diagrams.map(({ id }) => <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{t[id as "system" | "sequence" | "user"][0]}</button>)}
    </div>}
    {(showAll ? diagrams : diagrams.filter(({ id }) => id === selected)).map(({ id, chart }) => {
      const [label, title, description] = t[id as "system" | "sequence" | "user"];
      return <figure key={id} className="architecture-figure" aria-labelledby={id + "-diagram"}>
        <figcaption>
          <p className="diagram-kicker">{label}</p>
          {showAll ? <h2 id={id + "-diagram"}>{title}</h2> : <h3 id={id + "-diagram"}>{title}</h3>}
          <p>{description}</p>
        </figcaption>
        <MermaidDiagram chart={chart} locale={locale} />
        <p className="diagram-pan-hint">{t.pan}</p>
      </figure>;
    })}
  </div>;
}
