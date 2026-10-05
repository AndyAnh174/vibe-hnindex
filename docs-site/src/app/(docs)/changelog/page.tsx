"use client";
import { DocsLayout } from "@/components/docs/docs-layout";
import { useI18n } from "@/lib/i18n";
import { releases, VERSION } from "@/lib/release";
import { getPageNav } from "@/lib/navigation";
export default function Changelog() {
  const vi = useI18n().locale === "vi";
  return (
    <DocsLayout
      breadcrumbs={[{ label: "Docs", href: "/" }, { label: "Changelog" }]}
      pageNav={getPageNav("changelog")}
    >
      <p className="doc-eyebrow">RELEASE NOTES / v{VERSION}</p>
      <h1>{vi ? "Lịch sử cập nhật" : "The build log"}</h1>
      <p className="docs-lead">
        {vi
          ? "Cùng một changelog với website chính, sinh từ changelog của repository. Nội dung release được giữ bằng tiếng Anh."
          : "The same release history as the main website, generated from the repository changelog."}
      </p>
      {releases.map((release) => (
        <section className="docs-release-entry" key={release.version}>
          <span className="docs-release-version">v{release.version}</span>
          <h2 id={"v" + release.version}>{release.title}</h2>
          <ul>
            {release.items.map((item, i) => (
              <li key={i}>{item.replace(/\*\*/g, "").replace(/\x60/g, "")}</li>
            ))}
          </ul>
        </section>
      ))}
    </DocsLayout>
  );
}
