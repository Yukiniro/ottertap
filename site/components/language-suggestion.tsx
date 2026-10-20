'use client';
import { useEffect, useState } from 'react';
import { matchNavigatorLanguage, type Lang } from '~/lib/site-locales';

const storageKey = 'ottertap-site-lang-prompt';

type Choice = { id: Lang; path: string; hreflang: string; prompt: string; dismiss: string };

export function LanguageSuggestion({ current, options }: { current: Lang; options: Choice[] }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  useEffect(() => {
    if (current !== 'en' || localStorage.getItem(storageKey)) return;
    const matched = matchNavigatorLanguage(navigator.languages);
    if (!matched || matched === 'en') return;
    setChoice(options.find(option => option.id === matched) ?? null);
  }, [current, options]);
  if (!choice) return null;
  const dismiss = () => {
    localStorage.setItem(storageKey, 'dismissed');
    setChoice(null);
  };
  return <div className="border-b bg-accent px-5 py-2 text-sm" role="region" aria-label={choice.prompt}>
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <a className="font-medium underline-offset-4 hover:underline" href={choice.path} hrefLang={choice.hreflang} onClick={dismiss}>{choice.prompt}</a>
      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={dismiss}>{choice.dismiss}</button>
    </div>
  </div>;
}
