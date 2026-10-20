import { Home } from '~/components/home';
import { localeBySegment } from '~/lib/site-locales';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const locale = localeBySegment((await params).lang);
  return <Home lang={locale.id} />;
}
