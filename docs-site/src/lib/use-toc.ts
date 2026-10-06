"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { usePathname } from "next/navigation";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function useToc() {
  const { locale } = useI18n();
  const pathname = usePathname();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLHeadingElement>(
        ".docs-prose h2[id], .docs-prose h3[id]",
      ),
    );
    const tocItems = headings.map((h) => ({
      id: h.id,
      text: h.textContent || "",
      level: parseInt(h.tagName[1]),
    }));
    setItems(tocItems);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px" },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [locale, pathname]);

  return { items, activeId };
}
