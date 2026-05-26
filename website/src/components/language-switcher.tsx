'use client';

import { usePathname, useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { useState } from 'react';

const localeLabels: Record<string, string> = {
  en: 'EN',
  vi: 'VI',
};

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();
  const [open, setOpen] = useState(false);

  const switchTo = (locale: string) => {
    router.replace(pathname, { locale });
    setOpen(false);
  };

  const otherLocale = currentLocale === 'en' ? 'vi' : 'en';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm"
        aria-label="Switch language"
      >
        <Globe className="size-4" />
        {localeLabels[currentLocale] || currentLocale.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 rounded-md border bg-popover p-1 shadow-md">
          <button
            onClick={() => switchTo(otherLocale)}
            className="block w-full rounded-sm px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
          >
            {localeLabels[otherLocale]}
          </button>
        </div>
      )}
    </div>
  );
}
