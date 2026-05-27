"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Moon, Sun, Globe, ExternalLink, Boxes } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { docsNavigation } from "@/lib/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-1 p-4">
      <Link
        href="/"
        className="flex items-center gap-2 px-2 py-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={onNavigate}
      >
        <svg
          width="20"
          height="20"
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
                  onClick={onNavigate}
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
  );
}

export function Header() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggleLocale = () => {
    setLocale(locale === "en" ? "vi" : "en");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        {/* Mobile nav */}
        <Sheet>
          <SheetTrigger className="lg:hidden mr-2 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 pt-10">
            <ScrollArea className="h-full">
              <SidebarContent onNavigate={() => {
                const closeBtn = document.querySelector("[data-sheet-close]") as HTMLButtonElement;
                closeBtn?.click();
              }} />
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-6">
          <svg
            width="22"
            height="22"
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
          <span className="font-bold text-foreground hidden sm:inline">
            vibe-hnindex
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {t("nav.docs")}
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-1">
          <a
            href="https://github.com/AndyAnh174/vibe-hnindex"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">GitHub</span>
          </a>

          <a
            href="https://www.npmjs.com/package/vibe-hnindex"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Boxes className="h-4 w-4" />
            <span className="sr-only">npm</span>
          </a>

          {/* Language switcher */}
          <button
            onClick={toggleLocale}
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t("nav.switchLang")}
          >
            <Globe className="h-4 w-4" />
            <span className="sr-only">{t("nav.switchLang")}</span>
          </button>

          {/* Dark mode toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
