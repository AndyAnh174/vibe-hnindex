import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import enMessages from "@/messages/en.json";
import "./globals.css";
import "./refresh.css";

export const metadata: Metadata = {
  title: {
    default: "hnindex — Documentation",
    template: "%s — vibe-hnindex",
  },
  description:
    "Learn hnindex workspace context, local code navigation and optional semantic retrieval.",
  keywords: [
    "MCP",
    "code search",
    "AI",
    "Claude",
    "Cursor",
    "vibe-hnindex",
    "code indexing",
    "semantic search",
    "keyword search",
  ],
  authors: [
    { name: "Ho Viet Anh (AndyAnh174)", url: "https://github.com/AndyAnh174" },
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "vibe-hnindex",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased tracking-tight"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <I18nProvider defaultLocale="en" messages={enMessages}>
            <TooltipProvider>{children}</TooltipProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
