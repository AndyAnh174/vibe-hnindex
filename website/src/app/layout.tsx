import type { Metadata } from "next";
import "./globals.css";
import "./refresh.css";

export const metadata: Metadata = {
  title: {
    default: "hnindex — Project Context for AI Agents",
    template: "%s — vibe-hnindex",
  },
  description: "Workspace context, source code locations and optional semantic retrieval for your MCP agent.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
