import { Faq } from '~/components/faq';
import { Features } from '~/components/features';
import { FloatingSection } from '~/components/floating-section';
import { Hero } from '~/components/hero';
import { Install } from '~/components/install';
import { FloatingDemo } from '~/components/islands';
import { Privacy } from '~/components/privacy';
import { Providers } from '~/components/providers';
import { SiteFooter } from '~/components/site-footer';
import { SiteNav } from '~/components/site-nav';
import { loadMessages, type Lang } from '~/lib/locale';

export function Home({ lang }: { lang: Lang }) {
  const { site, extension } = loadMessages(lang);
  const t = (key: string) => site[key] ?? key;
  return <Providers extension={extension}>
    <SiteNav lang={lang} t={t} />
    <main>
      <Hero t={t} />
      <FloatingSection t={t} />
      <Features t={t} />
      <Privacy t={t} />
      <Install t={t} />
      <Faq t={t} />
    </main>
    <SiteFooter t={t} />
    <FloatingDemo mediaTitle={t('demoMediaTitle')} />
  </Providers>;
}
