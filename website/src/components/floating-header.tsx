"use client";

import { useState } from "react";
import { Menu, X, ArrowUpRight, Braces } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { VERSION } from "@/lib/release";

interface FloatingHeaderProps {
  locale: string;
  docs: string;
  changelog: string;
  github: string;
  npm: string;
}
export function FloatingHeader({
  locale,
  docs,
  changelog,
  github,
}: FloatingHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header" onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
    }}>
      <a className="skip-link" href="#main-content">
        {locale === "vi" ? "Đến nội dung" : "Skip to content"}
      </a>
      <div className="site-container header-inner">
        <Link href="/" className="brand" aria-label="hnindex home">
          <span className="brand-mark">
            <Braces size={19} aria-hidden />
          </span>
          <span>
            hnindex<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="https://docs.hnindex.cloud">{docs}</a>
          <Link href="/changelog">{changelog}</Link>
          <a href="https://github.com/AndyAnh174/vibe-hnindex">
            {github}
            <ArrowUpRight size={13} aria-hidden />
          </a>
        </nav>
        <div className="header-actions">
          <Link className="version-chip" href="/changelog">
            v{VERSION}
          </Link>
          <LanguageSwitcher />
          <button
            className="mobile-menu-button"
            aria-label={locale === "vi" ? (open ? "Đóng điều hướng" : "Mở điều hướng") : (open ? "Close navigation" : "Open navigation")}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-navigation"
          className="mobile-nav site-container"
          aria-label="Mobile navigation"
        >
          <a onClick={() => setOpen(false)} href="https://docs.hnindex.cloud">
            {docs}
          </a>
          <Link onClick={() => setOpen(false)} href="/changelog">
            {changelog}
          </Link>
          <a
            onClick={() => setOpen(false)}
            href="https://github.com/AndyAnh174/vibe-hnindex"
          >
            {github}
          </a>
        </nav>
      )}
    </header>
  );
}
