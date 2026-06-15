"use client";

import { useEffect, useRef } from "react";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      if (!cancelled && ref.current) {
        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(id, chart);
        ref.current.innerHTML = svg;
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);

  return <div ref={ref} className={className} />;
}
