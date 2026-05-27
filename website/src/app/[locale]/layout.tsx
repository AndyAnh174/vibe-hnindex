import { hasLocale } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { FloatingHeader } from '@/components/floating-header';

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
      <main className="flex-1">{children}</main>
      <Footer locale={locale} />
    </NextIntlClientProvider>
  );
}

async function HeaderWrapper({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  return (
    <FloatingHeader
      locale={locale}
      docs={t('docs')}
      changelog={t('changelog')}
      github={t('github')}
      npm={t('npm')}
    />
  );
}

async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  return (
    <footer className="border-t bg-gray-50 py-8 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-4">
        <p>
          {t('builtBy')}{" "}
          <a href="https://github.com/AndyAnh174" className="underline underline-offset-2 hover:text-foreground">
            AndyAnh174
          </a>
          {" "}· MIT License ·{" "}
          <a href="https://github.com/AndyAnh174/vibe-hnindex" className="underline underline-offset-2 hover:text-foreground">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
