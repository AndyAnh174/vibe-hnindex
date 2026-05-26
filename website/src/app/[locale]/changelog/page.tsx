'use client';

import { useTranslations } from 'next-intl';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { changelogData } from "./changelog-data";

export default function ChangelogPage() {
  const t = useTranslations('changelog');
  const versions = changelogData;

  if (!versions.length) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto max-w-5xl">
          <div className="px-6 py-8 lg:px-10">
            <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="container mx-auto max-w-5xl px-6 pt-10 lg:px-10">
        <div className="relative">
          {versions.map((version, idx) => {
            // Extract version number and date from title
            const versionMatch = version.title.match(/v(\d+\.\d+\.\d+)/);
            const versionNum = versionMatch ? versionMatch[1] : '';

            return (
              <div key={version.title} className="relative">
                <div className="flex flex-col md:flex-row gap-y-6">
                  {/* Left column: date + version badge */}
                  <div className="md:w-48 shrink-0">
                    <div className="md:sticky md:top-24 pb-10">
                      {idx === 0 && (
                        <Badge className="mb-3">{t('latest')}</Badge>
                      )}
                      {versionNum && (
                        <div className="inline-flex relative z-10 items-center justify-center w-10 h-10 text-foreground border rounded-lg text-sm font-bold">
                          {versionNum}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: content */}
                  <div className="flex-1 md:pl-8 relative pb-10">
                    {/* Timeline line */}
                    <div className="hidden md:block absolute top-2 left-0 w-px h-full bg-border">
                      <div className="hidden md:block absolute -translate-x-1/2 size-3 bg-primary rounded-full z-10" />
                    </div>

                    <div className="space-y-6">
                      <h2 className="text-2xl font-semibold tracking-tight text-balance">
                        {version.title}
                      </h2>

                      <ul className="space-y-3">
                        {version.items.map((item, i) => {
                          const match = item.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
                          if (match) {
                            return (
                              <li key={i} className="flex gap-3 text-sm">
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                <div>
                                  <span className="font-semibold text-foreground">{match[1]}</span>
                                  <span className="text-muted-foreground"> — {match[2]}</span>
                                </div>
                              </li>
                            );
                          }
                          return (
                            <li key={i} className="flex gap-3 text-sm">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
                              <span className="text-muted-foreground">{item}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator className="my-12" />
      <div className="pb-12 text-center text-sm text-muted-foreground">
        <p>
          {t('viewAllReleases')}{" "}
          <a
            href="https://github.com/AndyAnh174/vibe-hnindex/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            GitHub Releases
          </a>
        </p>
      </div>
    </div>
  );
}
