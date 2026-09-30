import type { Lang } from '@payinparts/core';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, sv, type MessageKey } from './messages';

const LanguageContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void } | null>(null);

function readStoredLang(): Lang {
  try {
    const value = localStorage.getItem('lang');
    if (value === 'sv' || value === 'en') return value;
  } catch {
    // storage can be blocked; fall back to Swedish
  }
  return 'sv';
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? readStoredLang());

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('lang', next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  const dict = ctx.lang === 'sv' ? sv : en;
  // Replaces {name} placeholders with values
  const t = (key: MessageKey, vars?: Record<string, string | number>) =>
    dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
  return { ...ctx, t };
}
