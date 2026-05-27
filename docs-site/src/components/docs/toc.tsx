"use client";

import { useToc } from "@/lib/use-toc";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function Toc() {
  const { items, activeId } = useToc();
  const { t } = useI18n();

  if (items.length === 0) return null;

  return (
    <aside className="hidden xl:block sticky top-14 h-[calc(100vh-3.5rem)] w-56 shrink-0">
      <div className="p-4 pt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          {t("common.onThisPage")}
        </h4>
        <nav className="flex flex-col gap-1 border-l border-border">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "block py-1 text-xs transition-colors border-l-2 -ml-px pl-3",
                item.level === 3 && "pl-6",
                activeId === item.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
