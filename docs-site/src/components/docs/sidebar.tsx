"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { docsNavigation } from "@/lib/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-border">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-1 p-4 pt-6">
          <Link
            href="/"
            className="flex items-center gap-2 px-2 py-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="font-semibold text-foreground">vibe-hnindex</span>
          </Link>
          {docsNavigation.map((section) => (
            <div key={section.slug} className="mb-3">
              <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                {t(section.title)}
              </h3>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.slug}
                      href={item.href}
                      className={cn(
                        "px-2 py-1.5 text-sm rounded-md transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      {t(item.title)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
