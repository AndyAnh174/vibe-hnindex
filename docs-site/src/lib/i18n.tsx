"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import enMessages from "@/messages/en.json";
import viMessages from "@/messages/vi.json";

type Messages = Record<string, unknown>;

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
  messages: Messages;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({
  children,
  defaultLocale,
  messages: initialMessages,
}: {
  children: ReactNode;
  defaultLocale: string;
  messages: Messages;
}) {
  const [locale, setLocaleState] = useState(defaultLocale);
  const [messages, setMessages] = useState(initialMessages);

  const setLocale = useCallback((newLocale: string) => {
    if (newLocale !== "en" && newLocale !== "vi") return;
    setLocaleState(newLocale);
    setMessages(newLocale === "vi" ? viMessages : enMessages);
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLocale;
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    }
  }, []);

  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((value) => value.startsWith("NEXT_LOCALE="))
      ?.split("=")[1];
    if (saved === "en" || saved === "vi") setLocale(saved);
  }, [setLocale]);

  const t = useCallback(
    (key: string) => getNestedValue(messages, key),
    [messages],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
