"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Header } from "@/components/docs/header";
import { Sidebar } from "@/components/docs/sidebar";
import { Toc } from "@/components/docs/toc";
import { Breadcrumbs } from "@/components/docs/breadcrumbs";
import { PageNavigation } from "@/components/docs/page-nav";
import { BackToTop } from "@/components/docs/back-to-top";
import type { PageNav } from "@/lib/navigation";
import enMessages from "@/messages/en.json";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function DocsLayout({
  children,
  breadcrumbs,
  pageNav,
}: {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  pageNav?: PageNav;
}) {
  return (
    <I18nProvider defaultLocale="en" messages={enMessages}>
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <div className="max-w-3xl mx-auto px-4 py-8 lg:px-8">
              {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
              <div className="docs-prose">{children}</div>
              {pageNav && <PageNavigation {...pageNav} />}
            </div>
          </main>
          <Toc />
        </div>
        <BackToTop />
      </div>
    </I18nProvider>
  );
}
