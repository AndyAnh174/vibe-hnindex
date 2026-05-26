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

                      <ul className="space-y-4">
                        {version.items.map((item, i) => {
                          // Bold title + description (feature header)
                          const titleMatch = item.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
                          if (titleMatch) {
                            return (
                              <li key={i} className="group">
                                <div className="flex gap-3">
                                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" />
                                  <div className="space-y-1">
                                    <span className="text-sm font-semibold text-foreground">{titleMatch[1]}</span>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{titleMatch[2]}</p>
                                  </div>
                                </div>
                              </li>
                            );
                          }

                          // Env vars
                          const envMatch = item.match(/^Env:\s+(.+)$/);
                          if (envMatch) {
                            return (
                              <li key={i} className="ml-5">
                                <div className="flex items-start gap-2">
                                  <Badge variant="secondary" className="mt-0.5 shrink-0 rounded-md px-1.5 py-0 text-[10px] font-mono">
                                    ENV
                                  </Badge>
                                  <code className="text-xs text-muted-foreground">{envMatch[1]}</code>
                                </div>
                              </li>
                            );
                          }

                          // Plain item (continuation line)
                          return (
                            <li key={i} className="ml-5">
                              <div className="flex gap-3">
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/30" />
                                <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                              </div>
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
