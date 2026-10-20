import type { ReactNode } from 'react';
import { SiteDocument } from '~/components/document';
import { localeBySegment, routedLocales } from '~/lib/site-locales';
import { siteMetadata } from '~/lib/metadata';
import '../globals.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return routedLocales.map(locale => ({ lang: locale.segment }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const locale = localeBySegment((await params).lang);
  return siteMetadata(locale.id, locale.path);
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const locale = localeBySegment((await params).lang);
  return <SiteDocument lang={locale.id}>{children}</SiteDocument>;
}
