import { i18n } from '#i18n';
import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Sun, Moon, Monitor, Globe, X, Check, CircleCheck, ArrowLeft, CircleAlert } from 'lucide-react';
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
import { normalizeDomain } from '../lib/settings';
import type { Settings } from '../lib/types';
import { useSettingsAtoms } from './theme';

const themes = [{ value: 'light', label: () => i18n.t('themeLight'), icon: Sun }, { value: 'dark', label: () => i18n.t('themeDark'), icon: Moon }, { value: 'system', label: () => i18n.t('themeSystem'), icon: Monitor }] as const;
const siteModes = [{ value: 'all', label: () => i18n.t('modeAll'), description: () => i18n.t('modeAllDescription') }, { value: 'allow', label: () => i18n.t('modeAllow'), description: () => i18n.t('modeAllowDescription') }, { value: 'exclude', label: () => i18n.t('modeExclude'), description: () => i18n.t('modeExcludeDescription') }] as const;

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return <section className="border-b py-8" aria-labelledby={id}>
    <h2 id={id} className="text-lg font-semibold">{title}</h2>
    {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
    <div className="mt-5 min-w-0">{children}</div>
  </section>;
}

export function SettingsPage({ back }: { back?: () => void }) {
  const { themeAtom, floatingAtom, siteModeAtom, sitesAtom, loadingAtom, errorAtom, writeSettingsAtom } = useSettingsAtoms();
  const theme = useAtomValue(themeAtom);
  const floating = useAtomValue(floatingAtom);
  const siteMode = useAtomValue(siteModeAtom);
  const sites = useAtomValue(sitesAtom);
  const loading = useAtomValue(loadingAtom);
  const error = useAtomValue(errorAtom);
  const write = useSetAtom(writeSettingsAtom);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
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

  return <div className="mx-auto min-h-screen w-full max-w-3xl px-5 pt-7 pb-12 md:px-8 md:pt-10">
    <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-b pb-7">
      <div className="min-w-0">
        {back && <Button variant="ghost" className="-ml-2.5 mb-4 text-muted-foreground" onClick={back}><ArrowLeft />{i18n.t('backToPanel')}</Button>}
        <Brand />
        <h1 className="mt-5 text-[28px] leading-[38px] font-bold tracking-tight">{i18n.t('settingsTitle')}</h1>
      </div>
      <Badge variant={error ? 'destructive' : 'secondary'} role="status" className="mt-3 h-6 px-2.5 text-sm">{error ? <CircleAlert /> : <CircleCheck />}{loading ? i18n.t('reading') : saving ? i18n.t('saving') : error ? i18n.t('unsaved') : saved ? i18n.t('saved') : i18n.t('autoSave')}</Badge>
    </header>
    <Section id="theme-label" title={i18n.t('appearance')} description={i18n.t('appearanceDescription')}>
      <ToggleGroup aria-labelledby="theme-label" variant="outline" spacing={2.5} className="flex-wrap" value={[theme]} disabled={disabled} onValueChange={value => { const next = value[0] as Settings['theme'] | undefined; if (next) void save({ theme: next }); }}>
        {themes.map(({ value, label, icon: Icon }) => <ToggleGroupItem key={value} value={value} size="lg" className="h-13 gap-2 px-4 aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground [&_svg:not([class*='size-'])]:size-5"><Icon /><span>{label()}</span>{theme === value && <Check className="size-4" />}</ToggleGroupItem>)}
      </ToggleGroup>
    </Section>
    <Section id="floating-label" title={i18n.t('floatingController')} description={i18n.t('floatingDescription')}>
      <Field orientation="horizontal" className="justify-between">
        <FieldLabel htmlFor="settings-floating" className="text-base font-normal">{i18n.t('showFloating')}</FieldLabel>
        <Switch id="settings-floating" aria-label={i18n.t('floatingController')} checked={floating} disabled={disabled} onCheckedChange={checked => void save({ floating: checked })} />
      </Field>
    </Section>
    <Section id="sites-label" title={i18n.t('siteRules')} description={i18n.t('siteRulesDescription')}>
      <h3 id="site-mode-label" className="text-sm font-medium">{i18n.t('siteScope')}</h3>
      <RadioGroup aria-labelledby="site-mode-label" className="mt-3 gap-3" value={siteMode} disabled={disabled} onValueChange={value => void save({ siteMode: value as Settings['siteMode'] })}>
        {siteModes.map(mode => <FieldLabel key={mode.value} htmlFor={'site-mode-' + mode.value}>
          <Field orientation="horizontal">
            <RadioGroupItem value={mode.value} id={'site-mode-' + mode.value} />
            <FieldContent><FieldTitle className="text-base">{mode.label()}</FieldTitle><FieldDescription>{mode.description()}</FieldDescription></FieldContent>
          </Field>
        </FieldLabel>)}
      </RadioGroup>
      <h3 id="site-list-label" className="mt-8 text-sm font-medium">{i18n.t('siteList')}</h3>
      <form className="mt-3" onSubmit={event => { event.preventDefault(); void addSite(); }}>
        <Field data-invalid={!!inputError}>
          <FieldLabel htmlFor="site-domain" className="sr-only">{i18n.t('siteDomain')}</FieldLabel>
          <div className="flex gap-3 max-sm:flex-col">
            <Input id="site-domain" className="h-12 flex-1 px-4 md:text-base" value={input} disabled={disabled} placeholder={i18n.t('sitePlaceholder')} aria-invalid={!!inputError} aria-describedby={inputError ? 'domain-error' : 'domain-tip'} onChange={event => { setInput(event.target.value); setInputError(''); }} />
            <Button type="submit" className="h-12 px-8 text-base" disabled={disabled || !input.trim()}>{i18n.t('addSite')}</Button>
          </div>
          <FieldError id="domain-error">{inputError}</FieldError>
          <FieldDescription id="domain-tip">{i18n.t('siteTip')}</FieldDescription>
        </Field>
      </form>
      {sites.length
        ? <ItemGroup aria-label={i18n.t('siteList')} className="mt-6 gap-0 border-t">{sites.map(site => <Item key={site} role="listitem" className="rounded-none border-b-border px-0 sm:px-4">
          <ItemMedia variant="icon" className="text-muted-foreground"><Globe className="size-5" /></ItemMedia>
          <ItemContent><ItemTitle className="line-clamp-none text-base font-normal break-all">{site}</ItemTitle></ItemContent>
          <ItemActions><Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('removeSite', { site })} disabled={disabled} onClick={() => void save({ sites: sites.filter(value => value !== site) })}><X /></Button></ItemActions>
        </Item>)}</ItemGroup>
        : <p className="mt-6 border-y px-2 py-6 text-sm text-muted-foreground">{siteMode === 'allow' ? i18n.t('allowEmpty') : siteMode === 'exclude' ? i18n.t('excludeEmpty') : i18n.t('allEmpty')}</p>}
    </Section>
    {error && <Alert variant="destructive" className="mt-4"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
