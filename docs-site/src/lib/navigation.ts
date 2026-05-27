export interface DocNavItem {
  title: string;
  href: string;
  slug: string;
}

export interface DocSection {
  title: string;
  slug: string;
  items: DocNavItem[];
}

export const docsNavigation: DocSection[] = [
  {
    title: "sidebar.gettingStarted",
    slug: "getting-started",
    items: [
      { title: "sidebar.introduction", href: "/", slug: "introduction" },
      { title: "sidebar.installation", href: "/getting-started/installation", slug: "installation" },
      { title: "sidebar.quickStart", href: "/getting-started/quick-start", slug: "quick-start" },
    ],
  },
  {
    title: "sidebar.configuration",
    slug: "configuration",
    items: [
      { title: "sidebar.configuration", href: "/configuration", slug: "configuration" },
    ],
  },
  {
    title: "sidebar.tools",
    slug: "tools",
    items: [
      { title: "sidebar.search", href: "/tools/search", slug: "search" },
      { title: "sidebar.indexCodebase", href: "/tools/index-codebase", slug: "index-codebase" },
      { title: "sidebar.smartContext", href: "/tools/smart-context", slug: "smart-context" },
      { title: "sidebar.benchmark", href: "/tools/benchmark", slug: "benchmark" },
    ],
  },
  {
    title: "sidebar.guides",
    slug: "guides",
    items: [
      { title: "sidebar.setupMcp", href: "/guides/setup-mcp", slug: "setup-mcp" },
      { title: "sidebar.performance", href: "/guides/performance", slug: "performance" },
      { title: "sidebar.troubleshooting", href: "/guides/troubleshooting", slug: "troubleshooting" },
    ],
  },
];

export interface PageNav {
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
}

const flatPages = docsNavigation.flatMap((s) =>
  s.items.map((i) => ({ ...i, section: s.slug }))
);

export function getPageNav(currentSlug: string): PageNav {
  const idx = flatPages.findIndex((p) => p.slug === currentSlug);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? { title: flatPages[idx - 1].title, href: flatPages[idx - 1].href } : undefined,
    next:
      idx < flatPages.length - 1
        ? { title: flatPages[idx + 1].title, href: flatPages[idx + 1].href }
        : undefined,
  };
}

export function getPageSection(currentSlug: string): string | undefined {
  const page = flatPages.find((p) => p.slug === currentSlug);
  return page?.section;
}
