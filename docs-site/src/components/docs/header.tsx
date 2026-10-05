"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Menu, Moon, Sun, Globe, ArrowUpRight, Braces } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SidebarContent } from "@/components/docs/sidebar";
import { VERSION } from "@/lib/release";
export function Header() {
  const { locale, setLocale } = useI18n(),
    { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <header className="docs-header">
      <a href="#main-content" className="docs-skip-link">
        {locale === "vi" ? "Đến nội dung" : "Skip to content"}
      </a>
      <div className="docs-header-inner">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="docs-icon-button docs-menu"
            aria-label={locale === "vi" ? "Mở điều hướng" : "Open navigation"}
          >
            <Menu size={20} />
          </SheetTrigger>
          <SheetContent side="left" className="docs-mobile-sheet">
            <SheetTitle className="px-6 pt-6">
              {locale === "vi" ? "Tài liệu hnindex" : "hnindex documentation"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Browse documentation pages
            </SheetDescription>
            <div className="overflow-y-auto">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <Link
          href="/"
          className="docs-brand"
          aria-label="hnindex documentation home"
        >
          <span>
            <Braces size={19} aria-hidden />
          </span>
          hnindex<span className="docs-brand-dot">.</span>
        </Link>
        <span className="docs-header-label">
          {locale === "vi" ? "Tài liệu" : "Documentation"}
        </span>
        <div className="docs-header-actions">
          <Link href="/changelog" className="docs-version">
            v{VERSION}
          </Link>
          <a className="docs-website-link" href="https://hnindex.cloud">
            {locale === "vi" ? "Trang chính" : "Website"}
            <ArrowUpRight size={13} aria-hidden />
          </a>
          <button
            className="docs-icon-button docs-locale"
            onClick={() => setLocale(locale === "en" ? "vi" : "en")}
            aria-label={
              locale === "en" ? "Switch to Vietnamese" : "Switch to English"
            }
          >
            <Globe size={16} />
            <span>{locale.toUpperCase()}</span>
          </button>
          <button
            className="docs-icon-button"
            disabled={!mounted}
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            aria-label={
              locale === "vi" ? "Đổi giao diện sáng/tối" : "Toggle color theme"
            }
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun size={17} />
            ) : (
              <Moon size={17} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
