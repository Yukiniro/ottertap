import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { links, listedStores, type T } from '~/lib/site-locales';
import { GitHubIcon } from './github-icon';
import HeroDemo from './hero-demo';
import { StoreButtons } from './store-buttons';

const appear = 'animate-in fade-in slide-in-from-bottom-3 duration-700 [animation-fill-mode:both] motion-reduce:animate-none';

export function Hero({ t }: { t: T }) {
  return <section className="px-5 py-12 md:py-16">
    <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_440px] lg:gap-16">
      <div className="flex flex-col items-start gap-6">
        <Badge variant="secondary" className={`h-6 px-3 ${appear}`}>{t('heroBadge')}</Badge>
        <h1 className={`text-4xl leading-[1.18] font-semibold tracking-tight whitespace-pre-line sm:text-5xl lg:text-6xl ${appear} [animation-delay:100ms]`}>{t('heroTitle')}</h1>
        <p className={`max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg ${appear} [animation-delay:200ms]`}>{t('heroSubtitle')}</p>
        <div className={`flex flex-wrap items-center gap-3 ${appear} [animation-delay:300ms]`}>
          <StoreButtons t={t} />
          <a className={cn(buttonVariants({ size: 'lg', variant: 'ghost' }), 'h-11 px-5')} href={links.repo} target="_blank" rel="noreferrer"><GitHubIcon className="size-4" />{t('ctaSource')}</a>
        </div>
        {listedStores().length === 0 && <p className="text-sm text-muted-foreground">{t('storePending')}</p>}
      </div>
      <div className={`min-w-0 ${appear} [animation-delay:500ms]`}>
        <HeroDemo copy={{ caption: t('demoCaption'), play: t('demoPlay'), pause: t('demoPause'), reset: t('demoReset'), addSecond: t('demoAddSecond'), removeSecond: t('demoRemoveSecond'), note: t('demoNote'), mediaTitle: t('demoMediaTitle'), secondTitle: t('demoSecondTitle') }} />
      </div>
    </div>
  </section>;
}
