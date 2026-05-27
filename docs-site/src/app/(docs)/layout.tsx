import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: "%s — vibe-hnindex",
  },
};

export default function DocsGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
