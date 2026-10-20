import { links, listedStores, type T } from '~/lib/site-locales';
import { StoreButtons } from './store-buttons';

export function Install({ t }: { t: T }) {
  const listed = listedStores().length > 0;
  const storeSteps = [1, 2, 3];
  const sideloadSteps = [1, 2, 3, 4];
  return <section id="install" className="border-y bg-card/60 px-5 py-20 md:py-28">
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">{t('installEyebrow')}</p>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">{listed ? t('installTitle') : t('sideloadSummary')}</h2>
          <p className="mt-3 text-muted-foreground">{listed ? t('installLead') : t('storePending')}</p>
        </div>
        <div className="flex flex-wrap gap-3"><StoreButtons t={t} /></div>
      </div>
      {listed && <ol className="grid gap-5 md:grid-cols-3">
        {storeSteps.map(step => <li key={step} className="flex flex-col gap-3 rounded-2xl border bg-background p-6 shadow-card">
          <span aria-hidden="true" className="text-4xl font-bold text-primary/30 tabular-nums">{`0${step}`}</span>
          <h3 className="text-lg font-semibold">{t(`installStep${step}Title`)}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(`installStep${step}Body`)}</p>
        </li>)}
      </ol>}
      <details className="rounded-2xl border bg-background p-6" {...(listed ? {} : { open: true })}>
        <summary className="cursor-pointer text-base font-semibold">{t('sideloadSummary')}</summary>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('sideloadLead')}</p>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sideloadSteps.map(step => <li key={step} className="flex flex-col gap-2">
            <span aria-hidden="true" className="text-sm font-semibold text-primary/50 tabular-nums">{`0${step}`}</span>
            <h3 className="text-sm font-semibold">{t(`sideloadStep${step}Title`)}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(`sideloadStep${step}Body`)}</p>
          </li>)}
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t('installUpdate')}</p>
        <a href={links.releases} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline">{t('ctaReleases')}</a>
      </details>
    </div>
  </section>;
}
