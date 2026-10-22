import otterMark from '@/assets/otter-mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { loadMessages, localeById, locales, type Lang, type T } from '~/lib/locale';
import { links } from '~/lib/site-locales';
import { GitHubIcon } from './github-icon';
import { ThemeToggle } from './theme-toggle';

function nativeName(lang: Lang) {
  return loadMessages(lang).site.nativeName ?? lang;
}

export function SiteNav({ lang, t }: { lang: Lang; t: T }) {
  const sections = [['features', t('navFeatures')], ['privacy', t('navPrivacy')], ['install', t('navInstall')], ['faq', t('navFaq')]] as const;
  const suffix = t('brandSuffix');
  return <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
    <nav aria-label={t('navMain')} className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-6 sm:px-5">
      <a href={localeById(lang).path} className="inline-flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight whitespace-nowrap">
        <img src={otterMark} alt="" className="size-8" />{t('brandName')}{suffix !== t('brandName') && <small className="hidden text-[11px] font-semibold text-muted-foreground sm:inline">{suffix}</small>}
      </a>
      <ul className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
        {sections.map(([id, label]) => <li key={id}><a href={`#${id}`} className="transition-colors hover:text-foreground">{label}</a></li>)}
      </ul>
      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <details className="relative">
          <summary aria-label={t('langMenuLabel')} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>{nativeName(lang)}</summary>
          <ul className="absolute right-0 z-50 mt-1 min-w-40 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md">
            {locales.map(locale => <li key={locale.id}>
              <a href={locale.path} hrefLang={locale.hreflang} lang={locale.htmlLang} aria-current={locale.id === lang ? 'page' : undefined} className={cn('block rounded-md px-2 py-1.5 hover:bg-accent', locale.id === lang && 'bg-accent font-medium')}>{nativeName(locale.id)}</a>
            </li>)}
          </ul>
        </details>
        <ThemeToggle label={t('themeLabel')} names={{ light: t('themeLight'), dark: t('themeDark'), system: t('themeSystem') }} />
        <a className={buttonVariants({ variant: 'ghost', size: 'icon' })} href={links.repo} target="_blank" rel="noreferrer" aria-label={t('github')}><GitHubIcon className="size-4" /></a>
      </div>
    </nav>
  </header>;
}
