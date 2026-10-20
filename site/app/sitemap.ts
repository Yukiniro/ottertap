import type { MetadataRoute } from 'next';
import { languageAlternates, locales, siteUrl } from '~/lib/locale';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map(locale => ({
    url: siteUrl + locale.path,
    alternates: { languages: languageAlternates }
  }));
}
