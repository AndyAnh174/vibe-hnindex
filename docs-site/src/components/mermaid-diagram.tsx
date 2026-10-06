"use client";
import { useEffect, useId, useRef, useState } from "react";
let engine: Promise<typeof import("mermaid").default> | undefined;
function getEngine() {
  return engine ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false, securityLevel: "strict", theme: "base", fontFamily: "Manrope, Arial, sans-serif",
      themeVariables: {
        primaryColor: "#e6f1eb", primaryTextColor: "#182b25", primaryBorderColor: "#598b76",
        lineColor: "#598b76", secondaryColor: "#eef2e9", tertiaryColor: "#fafbf7",
        clusterBkg: "#f6f8f2", clusterBorder: "#c6d7ca", edgeLabelBackground: "#ffffff",
        actorBkg: "#e6f1eb", actorBorder: "#598b76", actorTextColor: "#182b25",
        signalColor: "#254d36", signalTextColor: "#182b25", noteBkgColor: "#f1f4df",
        noteTextColor: "#182b25", noteBorderColor: "#c6d7ca",
      },
      flowchart: { useMaxWidth: true, htmlLabels: false },
      sequence: { useMaxWidth: true, wrap: true },
    });
    return mermaid;
  });
}
export function MermaidDiagram({ chart, className, locale = "en" }: { chart: string; className?: string; locale?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const id = "hnindex-diagram-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [result, setResult] = useState<{ chart: string; svg?: string; failed?: boolean }>();
  const [actualSize, setActualSize] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function draw() {
      try {
        const mermaid = await getEngine();
        if (cancelled) return;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) setResult({ chart, svg });
      } catch {
        if (!cancelled) setResult({ chart, failed: true });
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { observer.disconnect(); void draw(); }
    }, { rootMargin: "200px" });
    if (host.current) observer.observe(host.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [chart, id]);
  const current = result?.chart === chart ? result : undefined;
  const nativeWidth = Number(current?.svg?.match(/viewBox="[^"]*?\s([\d.]+)\s[\d.]+"/)?.[1]) || 1000;
  return <div ref={host} className={className}>
    <div className="diagram-zoom" role="group" aria-label={locale === "vi" ? "Kích thước sơ đồ" : "Diagram size"}>
      <button aria-pressed={!actualSize} onClick={() => setActualSize(false)}>{locale === "vi" ? "Tổng quan" : "Fit"}</button>
      <button aria-pressed={actualSize} onClick={() => setActualSize(true)}>100%</button>
    </div>
    <div className="diagram-canvas" role="region" aria-label={locale === "vi" ? "Sơ đồ có thể cuộn ngang" : "Scrollable diagram"} tabIndex={0} aria-busy={!current}>
      {current?.svg ? <div style={actualSize ? { minWidth: Math.max(640, nativeWidth) } : undefined} dangerouslySetInnerHTML={{ __html: current.svg }} /> :
        <p className="diagram-status" role="status">{current?.failed
          ? (locale === "vi" ? "Không tải được sơ đồ. Xem source bên dưới." : "Diagram could not load. View the source below.")
          : (locale === "vi" ? "Đang vẽ sơ đồ…" : "Drawing diagram…")}</p>}
    </div>
    <details className="diagram-source"><summary>{locale === "vi" ? "Xem source Mermaid" : "View Mermaid source"}</summary><pre><code>{chart}</code></pre></details>
  </div>;
}
