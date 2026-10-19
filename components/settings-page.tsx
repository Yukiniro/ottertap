import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { commandBindings, extensionShortcutApis, shortcutsSettingsUrl } from '../lib/commands';
import { useAtomValue, useSetAtom } from 'jotai';
import { Sun, AppWindow, Keyboard, Globe, Bookmark, X, CircleCheck, ArrowLeft, CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle } from './ui/field';
import { Input } from './ui/input';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from './ui/item';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Switch } from './ui/switch';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Brand } from './brand';
import { cn } from '../lib/utils';
import { forgetSitePref, normalizeDomain } from '../lib/settings';
import type { Settings, SitePref } from '../lib/types';
import { useSettingsAtoms } from './theme';

const themes = [{ value: 'light', label: () => i18n.t('themeLight') }, { value: 'dark', label: () => i18n.t('themeDark') }, { value: 'system', label: () => i18n.t('themeSystem') }] as const;
const siteModes = [{ value: 'all', label: () => i18n.t('modeAll'), description: () => i18n.t('modeAllDescription') }, { value: 'allow', label: () => i18n.t('modeAllow'), description: () => i18n.t('modeAllowDescription') }, { value: 'exclude', label: () => i18n.t('modeExclude'), description: () => i18n.t('modeExcludeDescription') }] as const;
const nav = [{ id: 'appearance', label: () => i18n.t('appearance'), icon: Sun }, { id: 'floating', label: () => i18n.t('floatingController'), icon: AppWindow }, { id: 'shortcuts', label: () => i18n.t('shortcuts'), icon: Keyboard }, { id: 'sites', label: () => i18n.t('siteRules'), icon: Globe }, { id: 'memory', label: () => i18n.t('rememberedSites'), icon: Bookmark }] as const;
const prefSummary = (pref: SitePref) => [pref.volume === undefined ? '' : i18n.t('rememberedVolume', { volume: Math.round(pref.volume * 100) }), pref.rate === undefined ? '' : i18n.t('rememberedRate', { rate: pref.rate })].filter(Boolean).join(' · ');

function ThemeThumb({ value }: { value: 'light' | 'dark' | 'system' }) {
  const frame = 'mb-2 block h-11 w-16 overflow-hidden rounded-md border';
  if (value === 'system') return <span aria-hidden="true" className={cn(frame, 'relative border-border')}>
    <span className="absolute inset-0 bg-white" />
    <span className="absolute inset-y-0 right-0 w-1/2 bg-[#191a21]" />
    <span className="absolute top-2 left-1.5 h-1 w-5 rounded-full bg-[#e4e1da]" />
    <span className="absolute top-4 left-1.5 h-1 w-3 rounded-full bg-[#d5d2cb]" />
    <span className="absolute top-2 right-1.5 h-1 w-4 rounded-full bg-[#3c3d48]" />
    <span className="absolute bottom-1.5 left-1.5 h-1.5 w-4 rounded-sm bg-[#655de9]" />
    <span className="absolute right-1.5 bottom-1.5 h-1.5 w-3 rounded-sm bg-[#a69cff]" />
  </span>;
  const dark = value === 'dark';
  return <span aria-hidden="true" className={cn(frame, 'flex flex-col gap-1 p-1.5', dark ? 'border-[#363742] bg-[#191a21]' : 'border-[#e6e4de] bg-white')}>
    <span className={cn('h-1 w-7 rounded-full', dark ? 'bg-[#3c3d48]' : 'bg-[#e6e4de]')} />
    <span className={cn('h-1 w-10 rounded-full', dark ? 'bg-[#4e4f5c]' : 'bg-[#d4d1ca]')} />
    <span className={cn('mt-auto h-1.5 w-5 rounded-sm', dark ? 'bg-[#a69cff]' : 'bg-[#655de9]')} />
  </span>;
}

function SaveStatus({ loading, saving, error, saved }: { loading: boolean; saving: boolean; error: string; saved: boolean }) {
  return <Badge variant={error ? 'destructive' : 'secondary'} role="status" className="h-auto min-h-6 px-2.5 py-1 text-sm whitespace-normal">{error ? <CircleAlert /> : <CircleCheck />}{loading ? i18n.t('reading') : saving ? i18n.t('saving') : error ? i18n.t('unsaved') : saved ? i18n.t('saved') : i18n.t('autoSave')}</Badge>;
}

function ShortcutKey({ shortcut }: { shortcut: string }) {
  if (!shortcut) return <span className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">{i18n.t('shortcutUnbound')}</span>;
  return <kbd className="inline-block rounded-md border bg-background px-2 py-1 font-mono text-xs whitespace-nowrap">{shortcut}</kbd>;
}

function useCommandBindings() {
  const [rows, setRows] = useState(() => commandBindings([]));
  useEffect(() => {
    const { commands } = extensionShortcutApis();
    let cancelled = false;
    const load = () => {
      if (!commands?.getAll) { setRows(commandBindings([])); return; }
      void Promise.resolve(commands.getAll()).then(list => {
        if (!cancelled) setRows(commandBindings(Array.isArray(list) ? list : []));
      }).catch(() => { if (!cancelled) setRows(commandBindings([])); });
    };
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, []);
  return rows;
}

function Row({ title, description, titleId, children }: { title: string; description?: string; titleId?: string; children: React.ReactNode }) {
  return <div className="grid gap-4 px-5 py-5 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-8 sm:px-6">
    <div className="min-w-0 sm:pt-0.5">
      <h3 id={titleId} className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>}
    </div>
    <div className="min-w-0">{children}</div>
  </div>;
}

export function SettingsPage({ back }: { back?: () => void }) {
  const { themeAtom, floatingAtom, siteModeAtom, sitesAtom, sitePrefsAtom, loadingAtom, errorAtom, writeSettingsAtom } = useSettingsAtoms();
  const theme = useAtomValue(themeAtom);
  const floating = useAtomValue(floatingAtom);
  const siteMode = useAtomValue(siteModeAtom);
  const sites = useAtomValue(sitesAtom);
  const sitePrefs = useAtomValue(sitePrefsAtom);
  const loading = useAtomValue(loadingAtom);
  const error = useAtomValue(errorAtom);
  const write = useSetAtom(writeSettingsAtom);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<(typeof nav)[number]['id']>('appearance');
  const commandRows = useCommandBindings();
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const nodes = nav.map(item => document.getElementById(item.id)).filter((node): node is HTMLElement => !!node);
    if (!nodes.length) return;
    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const line = window.matchMedia('(min-width: 768px)').matches ? 112 : 168;
      let current = nodes[0]!.id;
      for (const node of nodes) if (node.getBoundingClientRect().top <= line) current = node.id;
      if (nav.some(item => item.id === current)) setActive(current as (typeof nav)[number]['id']);
    };
    const observer = new IntersectionObserver(update, { rootMargin: '-96px 0px -40% 0px', threshold: [0, 0.25, 1] });
    for (const node of nodes) observer.observe(node);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => { cancelled = true; observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update); };
  }, []);
  const save = async (next: Partial<Settings>) => {
    setSaving(true); setSaved(false);
    const ok = await write(next);
    setSaving(false); setSaved(ok);
    return ok;
  };
  const addSite = async () => {
    try {
      const domain = normalizeDomain(input);
      if (sites.includes(domain)) { setInputError(i18n.t('siteDuplicate')); return; }
      if (await save({ sites: [...sites, domain] })) { setInput(''); setInputError(''); }
    } catch (err) { setInputError(err instanceof Error ? err.message : i18n.t('domainRejected')); }
  };
  const disabled = loading || saving;
  const status = <SaveStatus loading={loading} saving={saving} error={error} saved={saved} />;

  return <div className="min-h-screen bg-background md:grid md:grid-cols-[220px_1fr]">
    <aside className="sticky top-0 z-20 flex flex-col bg-[color-mix(in_srgb,var(--muted)_55%,var(--background))] md:h-screen md:self-start md:border-r">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-7">
        <div className="min-w-0">
          {back && <Button variant="ghost" className="-ml-2.5 mb-3 h-8 px-2 text-muted-foreground" onClick={back}><ArrowLeft />{i18n.t('backToPanel')}</Button>}
          <Brand />
          <h1 className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground max-md:sr-only">{i18n.t('settingsTitle')}</h1>
        </div>
        <div className="pt-1 md:hidden">{status}</div>
      </div>
      <nav aria-label={i18n.t('settingsTitle')} className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3 md:pb-0">
        {nav.map(item => {
          const Icon = item.icon;
          const current = active === item.id;
          return <a key={item.id} href={'#' + item.id} aria-current={current ? 'true' : undefined} className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors duration-150 md:whitespace-normal', current ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground')} onClick={() => setActive(item.id)}><Icon className="size-4 shrink-0" />{item.label()}</a>;
        })}
      </nav>
      <div className="mt-auto hidden px-5 pt-6 pb-6 md:block">
        {status}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{i18n.t('localOnly')}</p>
      </div>
    </aside>
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-10 md:py-10">
      <section id="appearance" aria-labelledby="theme-label" className="scroll-mt-32 rounded-xl bg-card shadow-card md:scroll-mt-8">
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-8 sm:px-6">
          <div className="min-w-0 sm:pt-1">
            <h2 id="theme-label" className="text-sm font-semibold">{i18n.t('appearance')}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('appearanceDescription')}</p>
          </div>
          <ToggleGroup aria-labelledby="theme-label" spacing={2} className="flex-wrap" value={[theme]} disabled={disabled} onValueChange={value => { const next = value[0] as Settings['theme'] | undefined; if (next) void save({ theme: next }); }}>
            {themes.map(({ value, label }) => <ToggleGroupItem key={value} value={value} className="h-auto flex-col gap-0 rounded-lg border border-transparent bg-muted/40 px-2.5 pt-2 pb-1.5 text-xs aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"><ThemeThumb value={value} /><span>{label()}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </section>
      <section id="floating" aria-labelledby="floating-heading" className="scroll-mt-32 rounded-xl bg-card shadow-card md:scroll-mt-8">
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-8 sm:px-6">
          <div className="min-w-0">
            <h2 id="floating-heading" className="text-sm font-semibold">{i18n.t('floatingController')}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('floatingDescription')}</p>
          </div>
          <Field orientation="horizontal" className="justify-between gap-4 rounded-lg bg-muted/50 px-3 py-3">
            <FieldLabel htmlFor="settings-floating" className="text-sm font-normal">{i18n.t('showFloating')}</FieldLabel>
            <Switch id="settings-floating" aria-label={i18n.t('floatingController')} checked={floating} disabled={disabled} onCheckedChange={checked => void save({ floating: checked })} />
          </Field>
        </div>
      </section>
      <section id="shortcuts" aria-labelledby="shortcuts-heading" className="scroll-mt-32 rounded-xl bg-card shadow-card md:scroll-mt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="shortcuts-heading" className="text-sm font-semibold">{i18n.t('shortcuts')}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('shortcutsDescription')}</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={() => {
            const tabs = extensionShortcutApis().tabs;
            if (tabs?.create) void Promise.resolve(tabs.create({ url: shortcutsSettingsUrl(navigator.userAgent) })).catch(() => {});
          }}>{i18n.t('editShortcuts')}</Button>
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <h3 className="mb-2 text-sm font-medium">{i18n.t('extensionShortcuts')}</h3>
          <dl className="divide-y rounded-lg bg-muted/50 px-3">
            {commandRows.map(command => <div key={command.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 text-sm">
              <dt><ShortcutKey shortcut={command.shortcut} /></dt>
              <dd className="text-muted-foreground">{i18n.t(command.message)}</dd>
            </div>)}
          </dl>
          <h3 className="mt-6 mb-2 text-sm font-medium">{i18n.t('pageShortcuts')}</h3>
          <dl className="divide-y rounded-lg bg-muted/50 px-3">
            {[
              { id: 'volume-up', key: '↑', description: i18n.t('shortcutVolumeUp') },
              { id: 'volume-down', key: '↓', description: i18n.t('shortcutVolumeDown') },
              { id: 'volume-wheel', key: i18n.t('shortcutWheel'), description: i18n.t('shortcutVolumeWheel') },
              { id: 'speed-up', key: '.', description: i18n.t('shortcutSpeedUp') },
              { id: 'speed-down', key: ',', description: i18n.t('shortcutSpeedDown') },
              { id: 'speed-reset', key: '0', description: i18n.t('shortcutSpeedReset') },
            ].map(shortcut => <div key={shortcut.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 text-sm">
              <dt><kbd className="inline-block rounded-md border bg-background px-2 py-1 font-mono text-xs whitespace-nowrap">Alt + Shift + {shortcut.key}</kbd></dt>
              <dd className="text-muted-foreground">{shortcut.description}</dd>
            </div>)}
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{i18n.t('shortcutsMac')}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{i18n.t('shortcutsRateKeys')}</p>
        </div>
      </section>
      <section id="sites" aria-labelledby="sites-label" className="scroll-mt-32 divide-y rounded-xl bg-card shadow-card md:scroll-mt-8">
        <div className="px-5 py-5 sm:px-6">
          <h2 id="sites-label" className="text-sm font-semibold">{i18n.t('siteRules')}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('siteRulesDescription')}</p>
        </div>
        <Row title={i18n.t('siteScope')} titleId="site-mode-label">
          <RadioGroup aria-labelledby="site-mode-label" className="gap-2" value={siteMode} disabled={disabled} onValueChange={value => void save({ siteMode: value as Settings['siteMode'] })}>
            {siteModes.map(mode => <FieldLabel key={mode.value} htmlFor={'site-mode-' + mode.value} className="has-data-checked:border-primary has-data-checked:bg-accent">
              <Field orientation="horizontal" className="items-start">
                <RadioGroupItem value={mode.value} id={'site-mode-' + mode.value} className="mt-0.5" />
                <FieldContent><FieldTitle>{mode.label()}</FieldTitle><FieldDescription>{mode.description()}</FieldDescription></FieldContent>
              </Field>
            </FieldLabel>)}
          </RadioGroup>
        </Row>
        <Row title={i18n.t('siteList')} titleId="site-list-label">
          <form onSubmit={event => { event.preventDefault(); void addSite(); }}>
            <Field data-invalid={!!inputError}>
              <FieldLabel htmlFor="site-domain" className="sr-only">{i18n.t('siteDomain')}</FieldLabel>
              <div className="flex gap-2 max-sm:flex-col">
                <Input id="site-domain" className="h-10 flex-1 px-3" value={input} disabled={disabled} placeholder={i18n.t('sitePlaceholder')} aria-invalid={!!inputError} aria-describedby={inputError ? 'domain-error' : 'domain-tip'} onChange={event => { setInput(event.target.value); setInputError(''); }} />
                <Button type="submit" className="h-10 px-5" disabled={disabled || !input.trim()}>{i18n.t('addSite')}</Button>
              </div>
              <FieldError id="domain-error">{inputError}</FieldError>
              <FieldDescription id="domain-tip">{i18n.t('siteTip')}</FieldDescription>
            </Field>
          </form>
          {sites.length
            ? <ItemGroup aria-label={i18n.t('siteList')} className="mt-3 gap-0 overflow-hidden rounded-lg bg-muted/50">{sites.map(site => <Item key={site} role="listitem" className="rounded-none border-b-border px-3 not-last:border-b">
              <ItemMedia variant="icon" className="text-muted-foreground"><Globe className="size-4" /></ItemMedia>
              <ItemContent><ItemTitle className="line-clamp-none font-normal break-all">{site}</ItemTitle></ItemContent>
              <ItemActions><Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('removeSite', { site })} disabled={disabled} onClick={() => void save({ sites: sites.filter(value => value !== site) })}><X /></Button></ItemActions>
            </Item>)}</ItemGroup>
            : <p className="mt-3 rounded-lg bg-muted/50 px-3 py-5 text-sm text-muted-foreground">{siteMode === 'allow' ? i18n.t('allowEmpty') : siteMode === 'exclude' ? i18n.t('excludeEmpty') : i18n.t('allEmpty')}</p>}
        </Row>
      </section>
      <section id="memory" aria-labelledby="memory-label" className="scroll-mt-32 rounded-xl bg-card shadow-card md:scroll-mt-8">
        <div className="px-5 py-5 sm:px-6">
          <h2 id="memory-label" className="text-sm font-semibold">{i18n.t('rememberedSites')}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('rememberedSitesDescription')}</p>
        </div>
        <div className="px-5 pb-5 sm:px-6">
          {Object.keys(sitePrefs).length
            ? <ItemGroup aria-label={i18n.t('rememberedSites')} className="gap-0 overflow-hidden rounded-lg bg-muted/50">{Object.entries(sitePrefs).sort(([a], [b]) => a.localeCompare(b)).map(([site, pref]) => <Item key={site} role="listitem" className="rounded-none border-b-border px-3 not-last:border-b">
              <ItemMedia variant="icon" className="text-muted-foreground"><Bookmark className="size-4" /></ItemMedia>
              <ItemContent><ItemTitle className="line-clamp-none font-normal break-all">{site}</ItemTitle><p className="text-xs text-muted-foreground">{prefSummary(pref)}</p></ItemContent>
              <ItemActions><Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('forgetSite', { site })} disabled={disabled} onClick={() => void save({ sitePrefs: forgetSitePref(sitePrefs, site) })}><X /></Button></ItemActions>
            </Item>)}</ItemGroup>
            : <p className="rounded-lg bg-muted/50 px-3 py-5 text-sm text-muted-foreground">{i18n.t('rememberedEmpty')}</p>}
        </div>
      </section>
      {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
      <p className="px-1 text-xs leading-5 text-muted-foreground md:hidden">{i18n.t('localOnly')}</p>
    </main>
  </div>;
}
