"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageNav } from "@/lib/navigation";

export function PageNavigation({ prev, next }: PageNav) {
  const { t } = useI18n();

  if (!prev && !next) return null;

  return (
    <div className="flex justify-between gap-4 mt-16 pt-8 border-t border-border">
      <div>
        {prev && (
          <Link
            href={prev.href}
            className="inline-flex flex-col items-start p-2 -ml-2 rounded-md hover:bg-muted transition-colors"
          >
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" />
              {t("common.previous")}
            </span>
            <span className="text-sm font-medium text-foreground">{t(prev.title)}</span>
          </Link>
        )}
      </div>
      <div>
        {next && (
          <Link
            href={next.href}
            className="inline-flex flex-col items-end p-2 -mr-2 rounded-md hover:bg-muted transition-colors text-right"
          >
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {t("common.next")}
              <ChevronRight className="h-3 w-3" />
            </span>
            <span className="text-sm font-medium text-foreground">{t(next.title)}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
