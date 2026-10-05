import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { VERSION } from "@/lib/release";
import { FloatingHeader } from "@/components/floating-header";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HeaderWrapper locale={locale} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer locale={locale} />
    </NextIntlClientProvider>
  );
}

async function HeaderWrapper({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "nav" });
  return (
    <FloatingHeader
      locale={locale}
      docs={t("docs")}
      changelog={t("changelog")}
      github={t("github")}
      npm={t("npm")}
    />
  );
}

async function Footer({ locale }: { locale: string }) {
  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <span>hnindex · v{VERSION} · MIT</span>
        <div className="footer-links">
          <a href="https://docs.hnindex.cloud">
            {locale === "vi" ? "Tài liệu" : "Documentation"}
          </a>
          <a href="https://github.com/AndyAnh174/vibe-hnindex">GitHub ↗</a>
          <a href="https://www.npmjs.com/package/vibe-hnindex">npm ↗</a>
          <a href="https://github.com/AndyAnh174">AndyAnh174</a>
        </div>
      </div>
    </footer>
  );
}
