"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { docsNavigation } from "@/lib/navigation";
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname(),
    { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const sections = docsNavigation
    .map((s) => ({
      ...s,
      items: s.items.filter((i) =>
        t(i.title).toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((s) => s.items.length);
  return (
    <div className="docs-sidebar-content">
      <label className="nav-search">
        <Search size={15} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === "vi" ? "Tìm trang tài liệu…" : "Find a page…"}
          aria-label={
            locale === "vi" ? "Tìm trang tài liệu" : "Find a documentation page"
          }
        />
      </label>
      <nav aria-label={locale === "vi" ? "Tài liệu" : "Documentation"}>
        {sections.map((section) => (
          <div className="docs-nav-section" key={section.slug}>
            <h2>{t(section.title)}</h2>
            {section.items.map((item) => (
              <Link
                className={pathname === item.href ? "active" : ""}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={onNavigate}
                href={item.href}
                key={item.slug}
              >
                {t(item.title)}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      {!sections.length && (
        <p className="nav-empty">
          {locale === "vi" ? "Không có trang phù hợp." : "No matching pages."}
        </p>
      )}
      <a
        className="sidebar-source"
        href="https://github.com/AndyAnh174/vibe-hnindex"
      >
        GitHub
        <ArrowUpRight size={13} aria-hidden />
      </a>
    </div>
  );
}
export function Sidebar() {
  return (
    <aside className="docs-sidebar">
      <SidebarContent />
    </aside>
  );
}
