import otterMark from '@/assets/otter-mark';
import { links, type T } from '~/lib/locale';

export function SiteFooter({ t }: { t: T }) {
  return <footer className="border-t px-5">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-2"><img src={otterMark} alt="" className="size-5" />{t('footerTagline')}</span>
      <span className="flex gap-5">
        <a href={links.repo} target="_blank" rel="noreferrer" className="hover:text-foreground">{t('github')}</a>
        <a href={links.releases} target="_blank" rel="noreferrer" className="hover:text-foreground">{t('footerReleases')}</a>      </span>
    </div>
  </footer>;
}
