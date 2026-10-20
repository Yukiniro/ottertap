import type { Metadata } from 'next';
import { languageAlternates, loadMessages, localeById, locales, siteUrl, type Lang } from './locale';

export function siteMetadata(lang: Lang, path: string): Metadata {
  const { site } = loadMessages(lang);
  const current = localeById(lang);
  const image = { url: `${siteUrl}/og.jpg`, width: 1200, height: 630, alt: site.metaTitle };
  return {
    title: site.metaTitle,
    description: site.metaDescription,
    icons: {
      icon: [{ url: '/favicon.png', sizes: '32x32', type: 'image/png' }],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
    },
    alternates: { canonical: siteUrl + path, languages: languageAlternates },
    openGraph: {
      type: 'website',
      siteName: 'OtterTap',
      url: siteUrl + path,
      title: site.metaTitle,
      description: site.metaDescription,
      locale: current.ogLocale,
      alternateLocale: locales.filter(locale => locale.id !== lang).map(locale => locale.ogLocale),
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: site.metaTitle,
      description: site.metaDescription,
      images: [image]
    }
  };
}
