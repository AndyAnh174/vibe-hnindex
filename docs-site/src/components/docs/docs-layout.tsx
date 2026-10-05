"use client";
import type { ReactNode } from "react";
import { Header } from "@/components/docs/header";
import { Sidebar } from "@/components/docs/sidebar";
import { Toc } from "@/components/docs/toc";
import { Breadcrumbs } from "@/components/docs/breadcrumbs";
import { PageNavigation } from "@/components/docs/page-nav";
import { BackToTop } from "@/components/docs/back-to-top";
import { useI18n } from "@/lib/i18n";
import { VERSION } from "@/lib/release";
import type { PageNav } from "@/lib/navigation";
import Link from "next/link";
export function DocsLayout({
  children,
  breadcrumbs,
  pageNav,
}: {
  children: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  pageNav?: PageNav;
}) {
  const { locale } = useI18n();
  return (
    <div className="docs-shell">
      <Header />
      <div className="docs-body">
        <Sidebar />
        <main id="main-content" className="docs-main">
          <div className="docs-article">
            {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
            <div className="docs-prose">{children}</div>
            {pageNav && <PageNavigation {...pageNav} />}
            <footer className="docs-footer">
              <span>hnindex · v{VERSION} · MIT</span>
              <Link href="/changelog">
                {locale === "vi" ? "Lịch sử cập nhật" : "Changelog"}
              </Link>
              <a href="https://github.com/AndyAnh174/vibe-hnindex">GitHub ↗</a>
            </footer>
          </div>
        </main>
        <Toc />
      </div>
      <BackToTop />
    </div>
  );
}
