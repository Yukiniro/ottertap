import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { links, listedStores, type T } from '~/lib/site-locales';
import { GitHubIcon } from './github-icon';
import { HeroDemo } from './islands';
import { StoreButtons } from './store-buttons';

const appear = 'animate-in fade-in slide-in-from-bottom-3 duration-700 [animation-fill-mode:both] motion-reduce:animate-none';

export function Hero({ t }: { t: T }) {
  return <section className="relative overflow-hidden px-5 pt-16 pb-20 md:pt-24 md:pb-28">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgb(101_93_233/.18),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgb(166_156_255/.16),transparent_70%)]" />
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center">
      <Badge variant="secondary" className={`h-6 px-3 ${appear}`}>{t('heroBadge')}</Badge>
      <h1 className={`bg-gradient-to-b from-foreground via-foreground/90 to-muted-foreground bg-clip-text pb-1 text-5xl leading-[1.12] font-bold tracking-tight whitespace-pre-line text-transparent sm:text-6xl lg:text-7xl ${appear} [animation-delay:100ms]`}>{t('heroTitle')}</h1>
      <p className={`max-w-xl text-base text-muted-foreground sm:text-lg ${appear} [animation-delay:200ms]`}>{t('heroSubtitle')}</p>
      <div className={`flex flex-wrap items-center justify-center gap-3 ${appear} [animation-delay:300ms]`}>
        <StoreButtons t={t} prominent />
        <a className={cn(buttonVariants({ size: 'lg', variant: 'ghost' }), 'h-11 px-5')} href={links.repo} target="_blank" rel="noreferrer"><GitHubIcon className="size-4" />{t('ctaSource')}</a>
      </div>
      {listedStores().length === 0 && <p className="text-sm text-muted-foreground">{t('storePending')}</p>}
      <div className={`mt-10 w-full ${appear} [animation-delay:500ms]`}>
        <HeroDemo copy={{ caption: t('demoCaption'), play: t('demoPlay'), pause: t('demoPause'), reset: t('demoReset'), addSecond: t('demoAddSecond'), removeSecond: t('demoRemoveSecond'), note: t('demoNote'), mediaTitle: t('demoMediaTitle'), secondTitle: t('demoSecondTitle') }} />
      </div>
    </div>
  </section>;
}
