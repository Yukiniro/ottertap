import type { MetadataRoute } from 'next';
import { siteUrl } from '~/lib/locale';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/zh/'].map(path => ({ url: siteUrl + path }));
}
