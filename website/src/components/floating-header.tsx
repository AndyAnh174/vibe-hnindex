"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useScroll } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface FloatingHeaderProps {
  locale: string;
  docs: string;
  changelog: string;
  github: string;
  npm: string;
}

export function FloatingHeader({ locale, docs, changelog, github, npm }: FloatingHeaderProps) {
  const { scrollY } = useScroll();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      setHasScrolled(latest > 10);
    });
    return unsubscribe;
  }, [scrollY]);

  return (
    <header
      className={cn(
        "sticky z-50 mx-4 flex justify-center transition-all duration-300 md:mx-0",
        hasScrolled ? "top-3" : "top-0",
      )}
    >
      <motion.div
        initial={{ width: "70rem" }}
        animate={{ width: hasScrolled ? "800px" : "70rem" }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div
          className={cn(
            "mx-auto max-w-7xl rounded-2xl transition-all duration-300",
            hasScrolled
              ? "border bg-white/75 backdrop-blur-lg shadow-sm"
              : "shadow-none",
          )}
        >
          <div className="flex h-[52px] items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="vibe-hnindex" className="h-7 w-auto" />
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm">
              <a
                href="https://docs.hnindex.cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {docs}
              </a>
              <Link
                href="/changelog"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {changelog}
              </Link>
              <a
                href="https://github.com/AndyAnh174/vibe-hnindex"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {github}
              </a>
              <a
                href="https://www.npmjs.com/package/vibe-hnindex"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {npm}
              </a>
              <LanguageSwitcher />
            </nav>

            <button
              className="md:hidden border size-8 rounded-lg cursor-pointer flex items-center justify-center"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            >
              {isDrawerOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 w-[95%] mx-auto bottom-3 bg-white border rounded-xl shadow-lg p-4 z-50"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0, transition: { type: "spring", damping: 20, stiffness: 200 } }}
              exit={{ opacity: 0, y: 100, transition: { duration: 0.15 } }}
            >
              <div className="flex flex-col gap-3">
                <a
                  href="https://docs.hnindex.cloud"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {docs}
                </a>
                <Link
                  href="/changelog"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {changelog}
                </Link>
                <a
                  href="https://github.com/AndyAnh174/vibe-hnindex"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {github}
                </a>
                <a
                  href="https://www.npmjs.com/package/vibe-hnindex"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {npm}
                </a>
                <div className="pt-2 border-t">
                  <LanguageSwitcher />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
