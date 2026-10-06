"use client";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { useEffect } from "react";
export function LanguageSwitcher() {
  const pathname = usePathname(),
    router = useRouter(),
    locale = useLocale();
  const other = locale === "en" ? "vi" : "en";
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <button
      className="language-button"
      aria-label={
        locale === "en" ? "Switch to Vietnamese" : "Switch to English"
      }
      onClick={() => router.replace(pathname, { locale: other })}
    >
      <Globe size={15} aria-hidden />
      {locale.toUpperCase()}
    </button>
  );
}
