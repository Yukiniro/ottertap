import otterMark from '@/assets/otter-mark';
import { buttonVariants } from '@/components/ui/button';
import { links, type Lang, type T } from '~/lib/locale';
import { GitHubIcon } from './github-icon';
import { ThemeToggle } from './theme-toggle';

export function SiteNav({ lang, t }: { lang: Lang; t: T }) {
  const sections = [['features', t('navFeatures')], ['privacy', t('navPrivacy')], ['install', t('navInstall')], ['faq', t('navFaq')]] as const;
  return <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
    <nav aria-label={t('navMain')} className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
      <a href={lang === 'zh' ? '/zh/' : '/'} className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight">
        <img src={otterMark} alt="" className="size-8" />{t('brandName')}{lang === 'zh' && <small className="text-[11px] font-semibold text-muted-foreground">OtterTap</small>}
      </a>
      <ul className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
        {sections.map(([id, label]) => <li key={id}><a href={`#${id}`} className="transition-colors hover:text-foreground">{label}</a></li>)}
      </ul>
      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <a className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={lang === 'zh' ? '/' : '/zh/'} hrefLang={lang === 'zh' ? 'en' : 'zh-CN'} aria-label={t('otherLangLabel')}>{t('otherLang')}</a>
        <ThemeToggle label={t('themeLabel')} names={{ light: t('themeLight'), dark: t('themeDark'), system: t('themeSystem') }} />
        <a className={buttonVariants({ variant: 'ghost', size: 'icon' })} href={links.repo} target="_blank" rel="noreferrer" aria-label={t('github')}><GitHubIcon className="size-4" /></a>
      </div>
    </nav>
  </header>;
}
