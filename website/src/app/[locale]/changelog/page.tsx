"use client";
import { useLocale } from "next-intl";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { releases, VERSION } from "@/lib/release";
import { Link } from "@/i18n/navigation";

function clean(text: string) {
  return text.replace(/\*\*/g, "").replace(/\x60/g, "");
}
export default function ChangelogPage() {
  const vi = useLocale() === "vi";
  return (
    <div className="site-container changelog-page">
      <div className="changelog-intro">
        <p className="eyebrow">{vi ? "LỊCH SỬ PHÁT TRIỂN" : "THE BUILD LOG"}</p>
        <h1>{vi ? "Từng bước tốt hơn." : "Better, with every release."}</h1>
        <p>
          {vi
            ? "Cập nhật ngữ cảnh agent, code graph, retrieval và trải nghiệm hnindex."
            : "Updates to agent context, code navigation, retrieval and the hnindex experience."}
        </p>
        <a
          className="text-link"
          href="https://github.com/AndyAnh174/vibe-hnindex/releases"
        >
          GitHub Releases
          <ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
      <div className="changelog-layout">
        <nav className="release-index" aria-label="Versions">
          <span className="eyebrow">{vi ? "PHIÊN BẢN" : "VERSIONS"}</span>
          {releases.map((release) => (
            <a key={release.version} href={"#v" + release.version}>
              v{release.version}
              {release.version === VERSION && <span className="status-dot" />}
            </a>
          ))}
        </nav>
        <div>
          {releases.map((release, i) => (
            <article
              className="release-entry"
              id={"v" + release.version}
              key={release.version}
            >
              <div className="release-entry-meta">
                <span className="version-chip">v{release.version}</span>
                {i === 0 && (
                  <span className="release-latest">
                    {vi ? "Bản cập nhật hiện tại" : "Current update"}
                  </span>
                )}
              </div>
              <h2>{release.title}</h2>
              <ul>
                {release.items.map((item, j) => (
                  <li key={j}>{clean(item)}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
      <Link className="text-link" href="/">
        {vi ? "Về trang chính" : "Back to hnindex"}
        <ArrowRight size={15} aria-hidden />
      </Link>
    </div>
  );
}
