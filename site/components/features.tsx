import { Gauge, Globe, Headphones, Layers, Play, SunMoon, Volume2, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { maxGain } from '@/lib/amplifier';
import { cn } from '@/lib/utils';
import type { T } from '~/lib/locale';

const tiles: { key: string; icon: LucideIcon; wide?: boolean; visual?: 'boost' | 'speed' }[] = [
  { key: 'Boost', icon: Volume2, wide: true, visual: 'boost' },
  { key: 'Channel', icon: Headphones },
  { key: 'Playback', icon: Play },
  { key: 'Speed', icon: Gauge, visual: 'speed' },
  { key: 'Multi', icon: Layers },
  { key: 'Sites', icon: Globe, wide: true },
  { key: 'Theme', icon: SunMoon }
];

function BoostVisual() {
  const maxPercent = Math.round(maxGain * 100);
  const mark = `${(100 / maxPercent) * 100}%`;
  const boosted = `${((100 + maxPercent) / 2 / maxPercent) * 100}%`;
  return <div aria-hidden="true" className="w-full max-w-sm">
    <div className="relative h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: boosted }} /><span className="absolute top-1/2 h-5 w-px -translate-y-1/2 bg-foreground/30" style={{ left: mark }} /></div>
    <div className="relative mt-2 h-4 text-[11px] text-muted-foreground"><span className="absolute left-0">0%</span><span className="absolute -translate-x-1/2" style={{ left: mark }}>100%</span><span className="absolute right-0 font-semibold text-primary">{maxPercent}%</span></div>
  </div>;
}

function SpeedVisual() {
  const presets = ['0.75', '1', '1.25', '1.5', '2', '2.5', '3', '4'];
  return <div aria-hidden="true" className="grid grid-cols-4 gap-1.5 text-xs">{presets.map(speed => <span key={speed} className={cn('rounded-md bg-secondary/60 py-2 text-center text-muted-foreground tabular-nums', speed === '3' && 'bg-primary font-semibold text-primary-foreground')}>{speed}×</span>)}</div>;
}

export function Features({ t }: { t: T }) {
  return <section id="features" className="px-5 py-20 md:py-28">
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <div className="flex flex-col items-start gap-4">
        <Badge variant="secondary">{t('featuresEyebrow')}</Badge>
        <h2 className="max-w-xl text-3xl font-bold tracking-tight md:text-4xl">{t('featuresTitle')}</h2>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{t('featuresSubtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ key, icon: Icon, wide, visual }) => <article key={key} className={cn('flex min-h-56 flex-col justify-between gap-6 rounded-xl border bg-card p-6', wide && 'lg:col-span-2')}>
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span>
          {visual === 'boost' && <BoostVisual />}
          {visual === 'speed' && <SpeedVisual />}
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xl font-semibold tracking-tight">{t(`feature${key}Title`)}</h3>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{t(`feature${key}Body`)}</p>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
