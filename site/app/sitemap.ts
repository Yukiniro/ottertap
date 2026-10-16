import type { MetadataRoute } from 'next';
import { langs, siteUrl } from '~/lib/locale';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', ...langs.map(lang => '/' + lang + '/')].map(path => ({ url: siteUrl + path }));
}
