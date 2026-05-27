import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "vibe-hnindex — MCP Code Search Server",
    template: "%s — vibe-hnindex",
  },
  description:
    "Local MCP server — index your repo once, search it in every AI session. Keyword, semantic, and hybrid search.",
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
  authors: [{ name: "Ho Viet Anh (AndyAnh174)", url: "https://github.com/AndyAnh174" }],
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
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
