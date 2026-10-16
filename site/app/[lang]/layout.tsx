import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Analytics } from '~/components/analytics';
import { isLang, langs } from '~/lib/locale';
import { siteMetadata } from '~/lib/metadata';
import { themeScript } from '~/lib/theme-script';
import '../globals.css';

export const dynamicParams = false;

export function generateStaticParams() { return langs.map(lang => ({ lang })); }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return siteMetadata(lang, `/${lang}/`);
}

export default async function LangLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <html lang={lang === 'zh' ? 'zh-CN' : 'en'} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}<Analytics /></body>
  </html>;
}
