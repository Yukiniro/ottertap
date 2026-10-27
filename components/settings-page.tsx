import { i18n } from '#i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { commandBindings, extensionShortcutApis, shortcutsSettingsUrl } from '../lib/commands';
import { useAtomValue, useSetAtom } from 'jotai';
import { Sun, AppWindow, Keyboard, Gauge, Globe, Bookmark, Archive, X, CircleCheck, ArrowLeft, CircleAlert, ChevronUp, ChevronDown, EyeOff } from 'lucide-react';
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
import { KeybindButton } from './keybind-button';
import { cn } from '../lib/utils';
import { defaultRatePresets, formatRate, maxRatePresets, parseRatePreset, sameRate } from '../lib/rate';
import { channelLabel } from '../lib/media';
import { defaultKeybinds, keybindOwner, keyLabel, recordedKey, sameKeybinds, type KeybindAction, type KeybindOwner } from '../lib/keybinds';
import { downloadSettingsBackup, parseSettingsBackup, readExtensionVersion, settingsBackupErrors, type SettingsBackupError } from '../lib/settings-backup';
import { readCurrentSiteHost, watchSiteTabs } from '../lib/current-site';
import { clearRememberedSites, filterFloatingHiddenSites, filterRememberedSites, filterSiteList, forgetSitePref, isFloatingNote, isRateStep, isSkipSeconds, isVolumeStep, isWheelDirection, normalizeDomain } from '../lib/settings';
import { rateSteps, skipSteps, volumeSteps, type Settings, type SitePref } from '../lib/types';
import { useSettingsAtoms } from './theme';

const themes = [{ value: 'light', label: () => i18n.t('themeLight') }, { value: 'dark', label: () => i18n.t('themeDark') }, { value: 'system', label: () => i18n.t('themeSystem') }] as const;
const siteModes = [{ value: 'all', label: () => i18n.t('modeAll'), description: () => i18n.t('modeAllDescription') }, { value: 'allow', label: () => i18n.t('modeAllow'), description: () => i18n.t('modeAllowDescription') }, { value: 'exclude', label: () => i18n.t('modeExclude'), description: () => i18n.t('modeExcludeDescription') }] as const;
const nav = [{ id: 'appearance', label: () => i18n.t('appearance'), icon: Sun }, { id: 'floating', label: () => i18n.t('floatingController'), icon: AppWindow }, { id: 'playback', label: () => i18n.t('playback'), icon: Gauge }, { id: 'shortcuts', label: () => i18n.t('shortcuts'), icon: Keyboard }, { id: 'presets', label: () => i18n.t('ratePresets'), icon: Gauge }, { id: 'sites', label: () => i18n.t('siteRules'), icon: Globe }, { id: 'memory', label: () => i18n.t('rememberedSites'), icon: Bookmark }, { id: 'backup', label: () => i18n.t('backup'), icon: Archive }] as const;
const importErrorMessage: Record<SettingsBackupError, () => string> = {
  [settingsBackupErrors.invalidJson]: () => i18n.t('importInvalidJson'),
  [settingsBackupErrors.notOttertap]: () => i18n.t('importNotOttertap'),
  [settingsBackupErrors.versionTooNew]: () => i18n.t('importVersionTooNew'),
  [settingsBackupErrors.versionTooOld]: () => i18n.t('importVersionTooOld')
};
const presetsMatch = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((rate, index) => rate === b[index]);
function reorderPresets(presets: readonly number[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= presets.length) return [...presets];
  const next = [...presets];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}

function RatePresetsSection({ presets, disabled, save }: { presets: number[]; disabled: boolean; save: (next: number[]) => Promise<boolean> }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const add = async () => {
    const rate = parseRatePreset(input);
    if (rate === null) { setError(i18n.t('ratePresetInvalid')); return; }
    if (presets.includes(rate)) { setError(i18n.t('ratePresetDuplicate')); return; }
    if (presets.length >= maxRatePresets) { setError(i18n.t('ratePresetLimit')); return; }
    if (await save([...presets, rate])) { setInput(''); setError(''); }
  };
  return <section id="presets" aria-labelledby="presets-heading" className="scroll-mt-32 rounded-xl border bg-card md:scroll-mt-8">
    <div className="px-5 py-5 sm:px-6">
      <h2 id="presets-heading" className="text-base font-semibold">{i18n.t('ratePresets')}</h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('ratePresetsDescription')}</p>
    </div>
    <div className="px-5 pb-5 sm:px-6">
      <ItemGroup aria-label={i18n.t('ratePresets')} className="gap-0 overflow-hidden rounded-lg bg-secondary/60">
        {presets.map((rate, index) => <Item key={rate} role="listitem" className="rounded-none border-b-border px-3 not-last:border-b">
          <ItemContent><ItemTitle className="font-normal tabular-nums">{formatRate(rate)}×</ItemTitle></ItemContent>
          <ItemActions>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('moveRatePresetUp', { rate: formatRate(rate) })} disabled={disabled || index === 0} onClick={() => void save(reorderPresets(presets, index, -1))}><ChevronUp /></Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('moveRatePresetDown', { rate: formatRate(rate) })} disabled={disabled || index === presets.length - 1} onClick={() => void save(reorderPresets(presets, index, 1))}><ChevronDown /></Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('removeRatePreset', { rate: formatRate(rate) })} disabled={disabled} onClick={() => void save(presets.filter(item => item !== rate))}><X /></Button>
          </ItemActions>
        </Item>)}
      </ItemGroup>
      <form className="mt-3" onSubmit={event => { event.preventDefault(); void add(); }}>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="rate-preset" className="sr-only">{i18n.t('addRatePreset')}</FieldLabel>
          <div className="flex gap-2 max-sm:flex-col">
            <Input id="rate-preset" inputMode="decimal" className="h-10 flex-1 px-3" value={input} disabled={disabled || presets.length >= maxRatePresets} placeholder={i18n.t('ratePresetPlaceholder')} aria-invalid={!!error} aria-describedby={error ? 'rate-preset-error' : presets.length >= maxRatePresets ? 'rate-preset-tip' : undefined} onChange={event => { setInput(event.target.value); setError(''); }} />
            <Button type="submit" className="h-10 px-5" disabled={disabled || !input.trim() || presets.length >= maxRatePresets}>{i18n.t('addRatePreset')}</Button>
          </div>
          <FieldError id="rate-preset-error">{error}</FieldError>
          {presets.length >= maxRatePresets && <FieldDescription id="rate-preset-tip">{i18n.t('ratePresetLimit')}</FieldDescription>}
        </Field>
      </form>
      <Button variant="outline" className="mt-3" disabled={disabled || presetsMatch(presets, defaultRatePresets)} onClick={() => void save([...defaultRatePresets])}>{i18n.t('resetRatePresets')}</Button>
    </div>
  </section>;
}

function BackupSection({ disabled, save }: { disabled: boolean; save: (next: Settings, replace: boolean) => Promise<boolean> }) {
  const { settingsAtom } = useSettingsAtoms();
  const settings = useAtomValue(settingsAtom);
  const fileRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [pending, setPending] = useState<Settings | null>(null);
  const [importError, setImportError] = useState('');
  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const request = ++requestId.current;
    setImportError('');
    setPending(null);
    void file.text().then(text => {
      if (request !== requestId.current) return;
      const result = parseSettingsBackup(text);
      if (!result.ok) { setImportError(importErrorMessage[result.error]()); return; }
      setPending(result.settings);
    }).catch(() => {
      if (request !== requestId.current) return;
      setImportError(i18n.t('importInvalidJson'));
    });
  };
  const confirmImport = async () => {
    if (!pending) return;
    if (await save(pending, true)) setPending(null);
  };
  return <section id="backup" aria-labelledby="backup-heading" className="scroll-mt-32 rounded-xl border bg-card md:scroll-mt-8">
    <div className="px-5 py-5 sm:px-6">
      <h2 id="backup-heading" className="text-base font-semibold">{i18n.t('backup')}</h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('backupDescription')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={disabled} onClick={() => downloadSettingsBackup(settings, readExtensionVersion())}>{i18n.t('exportSettings')}</Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()}>{i18n.t('importSettings')}</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />
      </div>
      {importError && <Alert variant="destructive" className="mt-4"><CircleAlert /><AlertDescription>{importError}</AlertDescription></Alert>}
      {pending && <div className="mt-4 rounded-lg border bg-muted/40 p-4" role="region" aria-labelledby="import-confirm-title">
        <h3 id="import-confirm-title" className="text-base font-semibold">{i18n.t('importConfirmTitle')}</h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('importConfirm')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="destructive" disabled={disabled} onClick={() => void confirmImport()}>{i18n.t('importConfirmAction')}</Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => setPending(null)}>{i18n.t('importCancel')}</Button>
        </div>
      </div>}
    </div>
  </section>;
}

const prefSummary = (pref: SitePref) => [pref.volume === undefined ? '' : i18n.t('rememberedVolume', { volume: Math.round(pref.volume * 100) }), pref.rate === undefined ? '' : i18n.t('rememberedRate', { rate: pref.rate }), pref.channel === undefined ? '' : channelLabel(pref.channel)].filter(Boolean).join(' · ');

type ReadCurrentHost = () => Promise<string | null>;

function useCurrentSiteHost() {
  const [host, setHost] = useState<string | null>(null);
  const read = useCallback(async () => {
    const next = await readCurrentSiteHost();
    setHost(next);
    return next;
  }, []);
  useEffect(() => {
    let cancelled = false;
    const pull = () => { void readCurrentSiteHost().then(next => { if (!cancelled) setHost(next); }); };
    pull();
    const stop = watchSiteTabs(pull);
    const onVisible = () => { if (document.visibilityState === 'visible') pull(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; stop(); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return { host, read };
}

function HostnameQuery({ id, label, query, setQuery, describedBy, disabled, host, onLocate, className }: { id: string; label: string; query: string; setQuery: (value: string) => void; describedBy?: string; disabled: boolean; host: string | null; onLocate: () => void; className?: string }) {
  const unavailableId = `${id}-current-site`;
  return <Field className={className}>
    <FieldLabel htmlFor={id} className="sr-only">{label}</FieldLabel>
    <div className="flex gap-2">
      <Input id={id} type="search" className="h-10 min-w-0 flex-1 px-3" value={query} disabled={disabled} placeholder={label} autoComplete="off" spellCheck={false} aria-describedby={describedBy} onChange={event => setQuery(event.target.value)} />
      <Button type="button" variant="outline" className="h-10 shrink-0 px-3" disabled={disabled || !host} title={host ?? i18n.t('currentSiteUnavailable')} aria-describedby={host ? undefined : unavailableId} onClick={onLocate}>{i18n.t('currentSite')}</Button>
      {!host && <p id={unavailableId} className="sr-only">{i18n.t('currentSiteUnavailable')}</p>}
    </div>
  </Field>;
}

function useLocateCurrentSite(readHost: ReadCurrentHost, setQuery: (value: string) => void) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [scrollToken, setScrollToken] = useState(0);
  useEffect(() => {
    if (scrollToken === 0) return;
    anchorRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [scrollToken]);
  const locate = () => {
    void readHost().then(next => {
      if (!next) return;
      setQuery(next);
      setScrollToken(token => token + 1);
    });
  };
  return { anchorRef, locate };
}

function RememberedSitesList({ prefs, disabled, onForget, host, readHost }: { prefs: Record<string, SitePref>; disabled: boolean; onForget: (site: string) => void; host: string | null; readHost: ReadCurrentHost }) {
  const [query, setQuery] = useState('');
  const visible = filterRememberedSites(prefs, query);
  const { anchorRef, locate } = useLocateCurrentSite(readHost, setQuery);
  return <>
    <HostnameQuery id="remembered-filter" label={i18n.t('rememberedFilter')} query={query} setQuery={setQuery} describedBy={visible.length === 0 ? 'remembered-no-match' : undefined} disabled={disabled} host={host} onLocate={locate} />
    <div ref={anchorRef} data-current-site-list="memory">
      {visible.length
        ? <ItemGroup aria-label={i18n.t('rememberedSites')} className="mt-3 gap-0 overflow-hidden rounded-lg bg-secondary/60">{visible.map(([site, pref]) => <Item key={site} role="listitem" className="rounded-none border-b-border px-3 not-last:border-b">
          <ItemMedia variant="icon" className="text-muted-foreground"><Bookmark className="size-4" /></ItemMedia>
          <ItemContent><ItemTitle className="line-clamp-none font-normal break-all">{site}</ItemTitle><p className="text-xs text-muted-foreground">{prefSummary(pref)}</p></ItemContent>
          <ItemActions><Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('forgetSite', { site })} disabled={disabled} onClick={() => onForget(site)}><X /></Button></ItemActions>
        </Item>)}</ItemGroup>
        : <p id="remembered-no-match" className="mt-3 rounded-lg bg-secondary/60 px-3 py-5 text-sm text-muted-foreground">{i18n.t('rememberedNoMatch')}</p>}
    </div>
  </>;
}

function SiteRulesList({ sites, disabled, onRemove, host, readHost }: { sites: readonly string[]; disabled: boolean; onRemove: (site: string) => void; host: string | null; readHost: ReadCurrentHost }) {
  const [query, setQuery] = useState('');
  const visible = filterSiteList(sites, query);
  const { anchorRef, locate } = useLocateCurrentSite(readHost, setQuery);
  return <>
    <HostnameQuery id="site-list-filter" className="mt-3" label={i18n.t('siteListFilter')} query={query} setQuery={setQuery} describedBy={visible.length === 0 ? 'site-list-no-match' : undefined} disabled={disabled} host={host} onLocate={locate} />
    <div ref={anchorRef} data-current-site-list="sites">
      {visible.length
        ? <ItemGroup aria-label={i18n.t('siteList')} className="mt-3 gap-0 overflow-hidden rounded-lg bg-secondary/60">{visible.map(site => <Item key={site} role="listitem" className="rounded-none border-b-border px-3 not-last:border-b">
          <ItemMedia variant="icon" className="text-muted-foreground"><Globe className="size-4" /></ItemMedia>
          <ItemContent><ItemTitle className="line-clamp-none font-normal break-all">{site}</ItemTitle></ItemContent>
          <ItemActions><Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('removeSite', { site })} disabled={disabled} onClick={() => onRemove(site)}><X /></Button></ItemActions>
        </Item>)}</ItemGroup>
        : <p id="site-list-no-match" className="mt-3 rounded-lg bg-secondary/60 px-3 py-5 text-sm text-muted-foreground">{i18n.t('siteListNoMatch')}</p>}
    </div>
  </>;
}

function FloatingHiddenSitesList({ sites, disabled, onRestore, host, readHost }: { sites: readonly string[]; disabled: boolean; onRestore: (site: string) => void; host: string | null; readHost: ReadCurrentHost }) {
  const [query, setQuery] = useState('');
  const visible = filterFloatingHiddenSites(sites, query);
  const { anchorRef, locate } = useLocateCurrentSite(readHost, setQuery);
  return <>
    <HostnameQuery id="floating-hidden-filter" className="mt-3" label={i18n.t('floatingHiddenFilter')} query={query} setQuery={setQuery} describedBy={visible.length === 0 ? 'floating-hidden-no-match' : undefined} disabled={disabled} host={host} onLocate={locate} />
    <div ref={anchorRef} data-current-site-list="floating">
      {visible.length
        ? <ItemGroup aria-label={i18n.t('floatingHiddenSites')} className="mt-3 gap-0 overflow-hidden rounded-lg bg-background/80">{visible.map(site => <Item key={site} role="listitem" className="rounded-none border-b-border px-3 not-last:border-b">
          <ItemMedia variant="icon" className="text-muted-foreground"><EyeOff className="size-4" /></ItemMedia>
          <ItemContent><ItemTitle className="line-clamp-none font-normal break-all">{site}</ItemTitle></ItemContent>
          <ItemActions><Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={i18n.t('restoreFloating', { site })} disabled={disabled} onClick={() => onRestore(site)}><X /></Button></ItemActions>
        </Item>)}</ItemGroup>
        : <p id="floating-hidden-no-match" className="mt-3 rounded-lg bg-background/80 px-3 py-3 text-sm text-muted-foreground">{i18n.t('floatingHiddenNoMatch')}</p>}
    </div>
  </>;
}

function RememberedSitesSection({ prefs, disabled, onForget, onClear, host, readHost }: { prefs: Record<string, SitePref>; disabled: boolean; onForget: (site: string) => void; onClear: () => Promise<boolean>; host: string | null; readHost: ReadCurrentHost }) {
  const [confirming, setConfirming] = useState(false);
  const filled = Object.keys(prefs).length > 0;
  useEffect(() => { if (!filled) setConfirming(false); }, [filled]);
  const confirmClear = async () => { if (await onClear()) setConfirming(false); };
  return <section id="memory" aria-labelledby="memory-label" className="scroll-mt-32 rounded-xl border bg-card md:scroll-mt-8">
    <div className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="memory-label" className="text-base font-semibold">{i18n.t('rememberedSites')}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('rememberedSitesDescription')}</p>
        </div>
        {filled && <Button type="button" variant="outline" className="shrink-0" disabled={disabled} onClick={() => setConfirming(true)}>{i18n.t('clearRemembered')}</Button>}
      </div>
      {confirming && <div className="mt-4 rounded-lg border bg-muted/40 p-4" role="region" aria-labelledby="clear-remembered-title">
        <h3 id="clear-remembered-title" className="text-base font-semibold">{i18n.t('clearRememberedTitle')}</h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('clearRememberedConfirm')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="destructive" disabled={disabled} onClick={() => void confirmClear()}>{i18n.t('clearRememberedAction')}</Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => setConfirming(false)}>{i18n.t('clearRememberedCancel')}</Button>
        </div>
      </div>}
    </div>
    <div className="px-5 pb-5 sm:px-6">
      {filled
        ? <RememberedSitesList prefs={prefs} disabled={disabled} onForget={onForget} host={host} readHost={readHost} />
        : <p className="rounded-lg bg-secondary/60 px-3 py-5 text-sm text-muted-foreground">{i18n.t('rememberedEmpty')}</p>}
    </div>
  </section>;
}

function ThemeThumb({ value }: { value: 'light' | 'dark' | 'system' }) {
  const frame = 'mb-2 block h-11 w-16 overflow-hidden rounded-md border';
  if (value === 'system') return <span aria-hidden="true" className={cn(frame, 'relative border-border')}>
    <span className="absolute inset-0 bg-white" />
    <span className="absolute inset-y-0 right-0 w-1/2 bg-[#202124]" />
    <span className="absolute top-2 left-1.5 h-1 w-5 rounded-full bg-[#e2e4e7]" />
    <span className="absolute top-4 left-1.5 h-1 w-3 rounded-full bg-[#c5c8cd]" />
    <span className="absolute top-2 right-1.5 h-1 w-4 rounded-full bg-[#414348]" />
    <span className="absolute bottom-1.5 left-1.5 h-1.5 w-4 rounded-sm bg-[#554bc4]" />
    <span className="absolute right-1.5 bottom-1.5 h-1.5 w-3 rounded-sm bg-[#b3acf5]" />
  </span>;
  const dark = value === 'dark';
  return <span aria-hidden="true" className={cn(frame, 'flex flex-col gap-1 p-1.5', dark ? 'border-[#414348] bg-[#202124]' : 'border-[#e2e4e7] bg-white')}>
    <span className={cn('h-1 w-7 rounded-full', dark ? 'bg-[#414348]' : 'bg-[#e2e4e7]')} />
    <span className={cn('h-1 w-10 rounded-full', dark ? 'bg-[#62666d]' : 'bg-[#c5c8cd]')} />
    <span className={cn('mt-auto h-1.5 w-5 rounded-sm', dark ? 'bg-[#b3acf5]' : 'bg-[#554bc4]')} />
  </span>;
}

function SaveStatus({ loading, saving, error, saved }: { loading: boolean; saving: boolean; error: string; saved: boolean }) {
  return <Badge variant={error ? 'destructive' : 'secondary'} role="status" className="h-auto min-h-6 px-2.5 py-1 text-sm whitespace-normal">{error ? <CircleAlert /> : <CircleCheck />}{loading ? i18n.t('reading') : saving ? i18n.t('saving') : error ? i18n.t('unsaved') : saved ? i18n.t('saved') : i18n.t('autoSave')}</Badge>;
}

function ShortcutKey({ shortcut }: { shortcut: string }) {
  if (!shortcut) return <span className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">{i18n.t('shortcutUnbound')}</span>;
  return <kbd className="inline-block rounded-md border bg-background px-2 py-1 font-mono text-xs whitespace-nowrap">{shortcut}</kbd>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-block rounded-md border bg-background px-2 py-1 font-mono text-xs whitespace-nowrap">{children}</kbd>;
}

/** A string key is fixed. A node key is an editable keybind. */
function ShortcutList({ label, rows }: { label: string; rows: { id: string; key: React.ReactNode; description: string }[] }) {
  return <dl aria-label={label} className="divide-y rounded-lg bg-secondary/60 px-3">
    {rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 text-sm">
      <dt>{typeof row.key === 'string' ? <Kbd>{row.key}</Kbd> : row.key}</dt>
      <dd className="text-muted-foreground">{row.description}</dd>
    </div>)}
  </dl>;
}

function SwitchRow({ id, label, description, checked, disabled, onChange }: { id: string; label: string; description: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return <Field orientation="horizontal" className="justify-between gap-4 rounded-lg bg-secondary/60 px-3 py-3">
    <FieldContent>
      <FieldLabel htmlFor={id} className="text-sm font-normal">{label}</FieldLabel>
      <FieldDescription id={id + '-description'}>{description}</FieldDescription>
    </FieldContent>
    <Switch id={id} aria-label={label} aria-describedby={id + '-description'} checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </Field>;
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
      <h3 id={titleId} className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>}
    </div>
    <div className="min-w-0">{children}</div>
  </div>;
}

export function SettingsPage({ back }: { back?: () => void }) {
  const { themeAtom, floatingAtom, floatingNoteAtom, floatingWhilePlayingAtom, floatingHiddenSitesAtom, defaultRateAtom, lockRateAtom, holdBoostAtom, holdBoostRateAtom, holdSkipAtom, hoverWheelAtom, fullscreenWheelAtom, singleKeyAtom, skipSecondsAtom, skipWithRateAtom, volumeStepAtom, coarseStepAtom, fineWheelAtom, wheelDirectionAtom, rateStepAtom, siteModeAtom, sitesAtom, sitePrefsAtom, ratePresetsAtom, keybindsAtom, loadingAtom, errorAtom, writeSettingsAtom } = useSettingsAtoms();
  const theme = useAtomValue(themeAtom);
  const floating = useAtomValue(floatingAtom);
  const floatingNote = useAtomValue(floatingNoteAtom);
  const floatingWhilePlaying = useAtomValue(floatingWhilePlayingAtom);
  const floatingHiddenSites = useAtomValue(floatingHiddenSitesAtom);
  const defaultRate = useAtomValue(defaultRateAtom);
  const lockRate = useAtomValue(lockRateAtom);
  const holdBoost = useAtomValue(holdBoostAtom);
  const holdBoostRate = useAtomValue(holdBoostRateAtom);
  const holdSkip = useAtomValue(holdSkipAtom);
  const hoverWheel = useAtomValue(hoverWheelAtom);
  const fullscreenWheel = useAtomValue(fullscreenWheelAtom);
  const singleKey = useAtomValue(singleKeyAtom);
  const skipSeconds = useAtomValue(skipSecondsAtom);
  const skipWithRate = useAtomValue(skipWithRateAtom);
  const volumeStep = useAtomValue(volumeStepAtom);
  const coarseStep = useAtomValue(coarseStepAtom);
  const fineWheel = useAtomValue(fineWheelAtom);
  const wheelDirection = useAtomValue(wheelDirectionAtom);
  const rateStep = useAtomValue(rateStepAtom);
  const siteMode = useAtomValue(siteModeAtom);
  const sites = useAtomValue(sitesAtom);
  const sitePrefs = useAtomValue(sitePrefsAtom);
  const ratePresets = useAtomValue(ratePresetsAtom);
  const keybinds = useAtomValue(keybindsAtom);
  const loading = useAtomValue(loadingAtom);
  const error = useAtomValue(errorAtom);
  const write = useSetAtom(writeSettingsAtom);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<(typeof nav)[number]['id']>('appearance');
  const [keyError, setKeyError] = useState<{ action: KeybindAction; message: string } | null>(null);
  const commandRows = useCommandBindings();
  const { host: currentHost, read: readCurrentHost } = useCurrentSiteHost();
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
  const save = async (next: Partial<Settings>, replace = false) => {
    setSaving(true); setSaved(false);
    const ok = await write(next, replace);
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
  const keyText = (key: string) => key ? keyLabel(key, i18n.t('keySpace')) : i18n.t('shortcutUnbound');
  const ownerLabels: Record<KeybindOwner, string> = {
    toggle: i18n.t('cmdPlayPause'),
    skipBack: i18n.t('skipBack', { seconds: skipSeconds }),
    skipForward: i18n.t('skipForward', { seconds: skipSeconds }),
    rateUp: i18n.t('shortcutSpeedUp', { step: formatRate(rateStep) }),
    rateDown: i18n.t('shortcutSpeedDown', { step: formatRate(rateStep) }),
    mute: i18n.t('cmdMute'),
    holdBoost: i18n.t('holdBoost'),
    frameBack: i18n.t('shortcutFrameBack'),
    frameForward: i18n.t('shortcutFrameForward'),
    mirror: i18n.t('mirror'),
    markSet: i18n.t('setMark'),
    markJump: i18n.t('jumpToMark'),
    volumeUp: i18n.t('shortcutVolumeUp', { percent: volumeStep }),
    volumeDown: i18n.t('shortcutVolumeDown', { percent: volumeStep })
  };
  const recordKey = (action: KeybindAction, event: KeyboardEvent) => {
    const key = recordedKey(event);
    if (!key) { setKeyError({ action, message: i18n.t('keybindUnsupported') }); return false; }
    const owner = keybindOwner(keybinds, key, action);
    if (owner) { setKeyError({ action, message: i18n.t('keybindConflict', { key: keyText(key), action: ownerLabels[owner] }) }); return false; }
    setKeyError(null);
    if (key !== keybinds[action]) void save({ keybinds: { ...keybinds, [action]: key } });
    return true;
  };
  const keyButton = (action: KeybindAction) => <KeybindButton label={ownerLabels[action]} keyLabel={keyText(keybinds[action])} disabled={loading} errorId="keybind-error" onKey={event => recordKey(action, event)} onCancel={() => setKeyError(current => current?.action === action ? null : current)} />;
  const keyErrorFor = (actions: readonly KeybindAction[]) => keyError && actions.includes(keyError.action) ? <p id="keybind-error" role="alert" className="mt-2 text-sm leading-5 text-destructive">{keyError.message}</p> : null;
  const status = <SaveStatus loading={loading} saving={saving} error={error} saved={saved} />;
  const defaultRateChoices = defaultRate != null && !defaultRatePresets.some(rate => sameRate(rate, defaultRate))
    ? [...defaultRatePresets, defaultRate].sort((a, b) => a - b)
    : defaultRatePresets;
  const holdRateChoices = defaultRatePresets.some(rate => sameRate(rate, holdBoostRate))
    ? defaultRatePresets
    : [...defaultRatePresets, holdBoostRate].sort((a, b) => a - b);

  return <div className="min-h-screen bg-secondary/30 md:grid md:grid-cols-[220px_1fr]">
    <aside className="sticky top-0 z-20 flex flex-col border-b bg-background md:h-screen md:self-start md:border-r">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-7">
        <div className="min-w-0">
          {back && <Button variant="ghost" className="-ml-2.5 mb-3 h-8 px-2 text-muted-foreground" onClick={back}><ArrowLeft />{i18n.t('backToPanel')}</Button>}
          <Brand />
          <p className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground max-md:sr-only">{i18n.t('settingsTitle')}</p>
        </div>
        <div className="pt-1 md:hidden">{status}</div>
      </div>
      <nav aria-label={i18n.t('settingsTitle')} className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3 md:pb-0">
        {nav.map(item => {
          const Icon = item.icon;
          const current = active === item.id;
          return <a key={item.id} href={'#' + item.id} aria-current={current ? 'true' : undefined} className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors duration-150 md:whitespace-normal', current ? 'bg-secondary font-semibold text-foreground' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground')} onClick={() => setActive(item.id)}><Icon className="size-4 shrink-0" />{item.label()}</a>;
        })}
      </nav>
      <div className="mt-auto hidden px-5 pt-6 pb-6 md:block">
        {status}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{i18n.t('localOnly')}</p>
      </div>
    </aside>
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('settingsTitle')}</h1>
      <section id="appearance" aria-labelledby="theme-label" className="scroll-mt-32 rounded-xl border bg-card md:scroll-mt-8">
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-8 sm:px-6">
          <div className="min-w-0 sm:pt-1">
            <h2 id="theme-label" className="text-base font-semibold">{i18n.t('appearance')}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('appearanceDescription')}</p>
          </div>
          <ToggleGroup aria-labelledby="theme-label" spacing={2} className="flex-wrap" value={[theme]} disabled={disabled} onValueChange={value => { const next = value[0] as Settings['theme'] | undefined; if (next) void save({ theme: next }); }}>
            {themes.map(({ value, label }) => <ToggleGroupItem key={value} value={value} className="h-auto flex-col gap-0 rounded-lg border border-transparent bg-muted/40 px-2.5 pt-2 pb-1.5 text-xs aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"><ThemeThumb value={value} /><span>{label()}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </section>
      <section id="floating" aria-labelledby="floating-heading" className="scroll-mt-32 rounded-xl border bg-card md:scroll-mt-8">
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-8 sm:px-6">
          <div className="min-w-0">
            <h2 id="floating-heading" className="text-base font-semibold">{i18n.t('floatingController')}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('floatingDescription')}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <Field orientation="horizontal" className="justify-between gap-4 rounded-lg bg-secondary/60 px-3 py-3">
              <FieldLabel htmlFor="settings-floating" className="text-sm font-normal">{i18n.t('showFloating')}</FieldLabel>
              <Switch id="settings-floating" aria-label={i18n.t('floatingController')} checked={floating} disabled={disabled} onCheckedChange={checked => void save({ floating: checked })} />
            </Field>
            <SwitchRow id="settings-floating-while-playing" label={i18n.t('floatingWhilePlaying')} description={i18n.t('floatingWhilePlayingDescription')} checked={floatingWhilePlaying} disabled={disabled} onChange={checked => void save({ floatingWhilePlaying: checked })} />
            <div className="rounded-lg bg-secondary/60 px-3 py-3">
              <h3 id="floating-note-label" className="text-sm font-medium">{i18n.t('floatingNote')}</h3>
              <ToggleGroup aria-labelledby="floating-note-label" spacing={1} className="mt-3 grid h-auto w-full grid-cols-3 rounded-lg bg-background/80 p-1" value={[floatingNote]} disabled={disabled} onValueChange={value => { const next = value[0]; if (isFloatingNote(next)) void save({ floatingNote: next }); }}>
                <ToggleGroupItem value="volume" className="h-8 rounded-md border-0 px-2 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('floatingNoteVolume')}</ToggleGroupItem>
                <ToggleGroupItem value="rate" className="h-8 rounded-md border-0 px-2 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('floatingNoteRate')}</ToggleGroupItem>
                <ToggleGroupItem value="off" className="h-8 rounded-md border-0 px-2 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('floatingNoteOff')}</ToggleGroupItem>
              </ToggleGroup>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('floatingNoteDescription')}</p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-3 py-3">
              <h3 className="text-sm font-medium">{i18n.t('floatingHiddenSites')}</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('floatingHiddenSitesDescription')}</p>
              {floatingHiddenSites.length
                ? <FloatingHiddenSitesList sites={floatingHiddenSites} disabled={disabled} onRestore={site => void save({ floatingHiddenSites: floatingHiddenSites.filter(value => value !== site) })} host={currentHost} readHost={readCurrentHost} />
                : <p className="mt-3 rounded-lg bg-background/80 px-3 py-3 text-sm text-muted-foreground">{i18n.t('floatingHiddenEmpty')}</p>}
            </div>
          </div>
        </div>
      </section>
      <section id="playback" aria-labelledby="playback-heading" className="scroll-mt-32 rounded-xl border bg-card md:scroll-mt-8">
        <div className="px-5 py-5 sm:px-6">
          <h2 id="playback-heading" className="text-base font-semibold">{i18n.t('playback')}</h2>
          <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">{i18n.t('lockRateDescription')}</p>
          <Field orientation="horizontal" className="mt-4 justify-between gap-4 rounded-lg bg-secondary/60 px-3 py-3">
            <FieldLabel htmlFor="settings-lock-rate" className="text-sm font-normal">{i18n.t('lockRate')}</FieldLabel>
            <Switch id="settings-lock-rate" aria-label={i18n.t('lockRate')} checked={lockRate} disabled={disabled} onCheckedChange={checked => void save({ lockRate: checked })} />
          </Field>
          <div className="mt-4">
            <Field orientation="horizontal" className="justify-between gap-4 rounded-lg bg-secondary/60 px-3 py-3">
              <FieldLabel htmlFor="settings-hold-boost" className="text-sm font-normal">{i18n.t('holdBoost')}</FieldLabel>
              <Switch id="settings-hold-boost" aria-label={i18n.t('holdBoost')} checked={holdBoost} disabled={disabled} onCheckedChange={checked => void save({ holdBoost: checked })} />
            </Field>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('holdBoostDescription', { key: keyText(keybinds.holdBoost) })}</p>
            <div className="mt-3">
              <SwitchRow id="settings-hold-skip" label={i18n.t('holdSkip')} description={i18n.t('holdSkipDescription', { back: keyText(keybinds.skipBack), forward: keyText(keybinds.skipForward), hold: keyText(keybinds.holdBoost) })} checked={holdSkip} disabled={disabled || !holdBoost} onChange={checked => void save({ holdSkip: checked })} />
            </div>
            <div className="mt-4 rounded-lg bg-secondary/60 px-3 py-3">
              <h3 id="hold-boost-rate-label" className="text-sm font-medium">{i18n.t('holdBoostRate')}</h3>
              <ToggleGroup aria-labelledby="hold-boost-rate-label" spacing={1} className="mt-3 flex h-auto w-full flex-wrap justify-start rounded-lg bg-background/80 p-1" value={[String(holdBoostRate)]} disabled={disabled} onValueChange={value => { const rate = Number(value[0]); if (Number.isFinite(rate)) void save({ holdBoostRate: rate }); }}>
                {holdRateChoices.map(rate => <ToggleGroupItem key={rate} value={String(rate)} className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('defaultRateOption', { rate: formatRate(rate) })}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
          </div>
          <div className="mt-4">
            <div className="rounded-lg bg-secondary/60 px-3 py-3">
              <h3 id="default-rate-label" className="text-sm font-medium">{i18n.t('defaultRate')}</h3>
              <ToggleGroup aria-labelledby="default-rate-label" spacing={1} className="mt-3 flex h-auto w-full flex-wrap justify-start rounded-lg bg-background/80 p-1" value={[defaultRate == null ? 'follow' : String(defaultRate)]} disabled={disabled} onValueChange={value => { const next = value[0]; if (next === 'follow') { if (defaultRate != null) void save({ defaultRate: null }); return; } const rate = Number(next); if (Number.isFinite(rate)) void save({ defaultRate: rate }); }}>
                <ToggleGroupItem value="follow" className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('defaultRateFollow')}</ToggleGroupItem>
                {defaultRateChoices.map(rate => <ToggleGroupItem key={rate} value={String(rate)} className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('defaultRateOption', { rate: formatRate(rate) })}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('defaultRateDescription')}</p>
          </div>
          <div className="mt-4">
            <div className="flex flex-col gap-3 rounded-lg bg-secondary/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 id="skip-seconds-label" className="text-sm font-medium">{i18n.t('skipSeconds')}</h3>
              <ToggleGroup aria-labelledby="skip-seconds-label" spacing={1} className="grid h-auto w-full grid-cols-4 rounded-lg bg-background/80 p-1 sm:w-auto" value={[String(skipSeconds)]} disabled={disabled} onValueChange={value => { const next = Number(value[0]); if (isSkipSeconds(next)) void save({ skipSeconds: next }); }}>
                {skipSteps.map(seconds => <ToggleGroupItem key={seconds} value={String(seconds)} className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('skipSecondsOption', { seconds })}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('skipSecondsDescription')}</p>
            <div className="mt-3">
              <SwitchRow id="settings-skip-with-rate" label={i18n.t('skipWithRate')} description={i18n.t('skipWithRateDescription')} checked={skipWithRate} disabled={disabled} onChange={checked => void save({ skipWithRate: checked })} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col gap-3 rounded-lg bg-muted/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 id="volume-step-label" className="text-sm font-medium">{i18n.t('volumeStep')}</h3>
              <ToggleGroup aria-labelledby="volume-step-label" spacing={1} className="grid h-auto w-full grid-cols-3 rounded-lg bg-background/80 p-1 sm:w-auto" value={[String(volumeStep)]} disabled={disabled} onValueChange={value => { const next = Number(value[0]); if (isVolumeStep(next)) void save({ volumeStep: next }); }}>
                {volumeSteps.map(percent => <ToggleGroupItem key={percent} value={String(percent)} className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('volumeStepOption', { percent })}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('volumeStepDescription')}</p>
            <div className="mt-4 flex flex-col gap-3 rounded-lg bg-secondary/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 id="coarse-step-label" className="text-sm font-medium">{i18n.t('coarseStep')}</h3>
              <ToggleGroup id="settings-coarse-step" aria-labelledby="coarse-step-label" spacing={1} className="grid h-auto w-full grid-cols-3 rounded-lg bg-background/80 p-1 sm:w-auto" value={[String(coarseStep)]} disabled={disabled} onValueChange={value => { const next = Number(value[0]); if (isVolumeStep(next)) void save({ coarseStep: next }); }}>
                {volumeSteps.map(percent => <ToggleGroupItem key={percent} value={String(percent)} className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('volumeStepOption', { percent })}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('coarseStepDescription')}</p>
            <div className="mt-3">
              <SwitchRow id="settings-fine-wheel" label={i18n.t('fineWheel')} description={i18n.t('fineWheelDescription')} checked={fineWheel} disabled={disabled} onChange={checked => void save({ fineWheel: checked })} />
            </div>
            <div className="mt-4 rounded-lg bg-secondary/60 px-3 py-3">
              <h3 id="wheel-direction-label" className="text-sm font-medium">{i18n.t('wheelDirection')}</h3>
              <ToggleGroup id="settings-wheel-direction" aria-labelledby="wheel-direction-label" spacing={1} className="mt-3 grid h-auto w-full grid-cols-2 rounded-lg bg-background/80 p-1" value={[wheelDirection]} disabled={disabled} onValueChange={value => { const next = value[0]; if (isWheelDirection(next)) void save({ wheelDirection: next }); }}>
                <ToggleGroupItem value="up" className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('wheelDirectionUp')}</ToggleGroupItem>
                <ToggleGroupItem value="down" className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('wheelDirectionDown')}</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('wheelDirectionDescription')}</p>
          </div>
          <div className="mt-4">
            <div className="flex flex-col gap-3 rounded-lg bg-secondary/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 id="rate-step-label" className="text-sm font-medium">{i18n.t('rateStep')}</h3>
              <ToggleGroup aria-labelledby="rate-step-label" spacing={1} className="grid h-auto w-full grid-cols-3 rounded-lg bg-background/80 p-1 sm:w-auto" value={[String(rateStep)]} disabled={disabled} onValueChange={value => { const next = Number(value[0]); if (isRateStep(next)) void save({ rateStep: next }); }}>
                {rateSteps.map(step => <ToggleGroupItem key={step} value={String(step)} className="h-8 rounded-md border-0 px-2.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{i18n.t('rateStepOption', { step: formatRate(step) })}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{i18n.t('rateStepDescription')}</p>
          </div>
        </div>
      </section>
      <section id="shortcuts" aria-labelledby="shortcuts-heading" className="scroll-mt-32 rounded-xl border bg-card md:scroll-mt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="shortcuts-heading" className="text-base font-semibold">{i18n.t('shortcuts')}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{i18n.t('shortcutsDescription')}</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={() => {
            const tabs = extensionShortcutApis().tabs;
            if (tabs?.create) void Promise.resolve(tabs.create({ url: shortcutsSettingsUrl(navigator.userAgent) })).catch(() => {});
          }}>{i18n.t('editShortcuts')}</Button>
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <h3 className="mb-2 text-sm font-medium">{i18n.t('extensionShortcuts')}</h3>
          <dl className="divide-y rounded-lg bg-secondary/60 px-3">
            {commandRows.map(command => <div key={command.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 text-sm">
              <dt><ShortcutKey shortcut={command.shortcut} /></dt>
              <dd className="text-muted-foreground">{i18n.t(command.message)}</dd>
            </div>)}
          </dl>
          <h3 className="mt-6 text-sm font-medium">{i18n.t('pageShortcuts')}</h3>
          <p className="mt-1 mb-2 text-xs leading-5 text-muted-foreground">{i18n.t('keybindsDescription')}</p>
          <ShortcutList label={i18n.t('pageShortcuts')} rows={[
            { id: 'volume-wheel', key: `Alt + ${i18n.t('shortcutWheel')}`, description: i18n.t('shortcutVolumeWheel') },
            { id: 'frame-back', key: keyButton('frameBack'), description: ownerLabels.frameBack },
            { id: 'frame-forward', key: keyButton('frameForward'), description: ownerLabels.frameForward },
            { id: 'mirror', key: keyButton('mirror'), description: ownerLabels.mirror },
            { id: 'mark-set', key: keyButton('markSet'), description: ownerLabels.markSet },
            { id: 'mark-jump', key: keyButton('markJump'), description: ownerLabels.markJump },
            { id: 'speed-up', key: 'Alt + .', description: i18n.t('shortcutSpeedUp', { step: formatRate(rateStep) }) },
            { id: 'speed-down', key: 'Alt + ,', description: i18n.t('shortcutSpeedDown', { step: formatRate(rateStep) }) },
            { id: 'speed-reset', key: 'Alt + 0', description: i18n.t('shortcutSpeedReset') },
            { id: 'mute', key: 'Alt + M', description: i18n.t('cmdMute') }
          ]} />
          {keyErrorFor(['frameBack', 'frameForward', 'mirror', 'markSet', 'markJump'])}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{i18n.t('shortcutsMac')}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{i18n.t('shortcutsRateKeys')}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{i18n.t('shortcutsFrameKeys', { back: keyText(keybinds.frameBack), forward: keyText(keybinds.frameForward) })}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{i18n.t('shortcutsTyping')}</p>
          <div className="mt-4 flex flex-col gap-2">
            <SwitchRow id="settings-hover-wheel" label={i18n.t('hoverWheel')} description={i18n.t('hoverWheelDescription')} checked={hoverWheel} disabled={disabled} onChange={checked => void save({ hoverWheel: checked })} />
            <SwitchRow id="settings-fullscreen-wheel" label={i18n.t('fullscreenWheel')} description={i18n.t('fullscreenWheelDescription')} checked={fullscreenWheel} disabled={disabled} onChange={checked => void save({ fullscreenWheel: checked })} />
            <SwitchRow id="settings-single-key" label={i18n.t('singleKey')} description={i18n.t('singleKeyDescription')} checked={singleKey} disabled={disabled} onChange={checked => void save({ singleKey: checked })} />
          </div>
          <h3 className="mt-6 mb-2 text-sm font-medium">{i18n.t('singleKeyShortcuts')}</h3>
          <ShortcutList label={i18n.t('singleKeyShortcuts')} rows={[
            { id: 'toggle', key: keyButton('toggle'), description: ownerLabels.toggle },
            { id: 'skip-back', key: <span className="flex items-center gap-1.5">{keyButton('skipBack')}<span aria-hidden="true" className="text-muted-foreground">/</span><Kbd>←</Kbd></span>, description: ownerLabels.skipBack },
            { id: 'skip-forward', key: <span className="flex items-center gap-1.5">{keyButton('skipForward')}<span aria-hidden="true" className="text-muted-foreground">/</span><Kbd>→</Kbd></span>, description: ownerLabels.skipForward },
            { id: 'volume-up', key: '↑', description: ownerLabels.volumeUp },
            { id: 'volume-down', key: '↓', description: ownerLabels.volumeDown },
            { id: 'mute', key: keyButton('mute'), description: ownerLabels.mute },
            { id: 'speed-up', key: keyButton('rateUp'), description: ownerLabels.rateUp },
            { id: 'speed-down', key: keyButton('rateDown'), description: ownerLabels.rateDown },
            { id: 'hold-boost', key: keyButton('holdBoost'), description: ownerLabels.holdBoost }
          ]} />
          {keyErrorFor(['toggle', 'skipBack', 'skipForward', 'mute', 'rateUp', 'rateDown', 'holdBoost'])}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{i18n.t('shortcutsSingleKeyArrows')}</p>
          <Button variant="outline" className="mt-4" disabled={loading || sameKeybinds(keybinds, defaultKeybinds)} onClick={() => { setKeyError(null); void save({ keybinds: { ...defaultKeybinds } }); }}>{i18n.t('resetKeybinds')}</Button>
        </div>
      </section>
      <RatePresetsSection presets={ratePresets} disabled={disabled} save={async next => save({ ratePresets: next })} />
      <section id="sites" aria-labelledby="sites-label" className="scroll-mt-32 divide-y rounded-xl border bg-card md:scroll-mt-8">
        <div className="px-5 py-5 sm:px-6">
          <h2 id="sites-label" className="text-base font-semibold">{i18n.t('siteRules')}</h2>
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
            ? <SiteRulesList key={siteMode} sites={sites} disabled={disabled} onRemove={site => void save({ sites: sites.filter(value => value !== site) })} host={currentHost} readHost={readCurrentHost} />
            : <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-5 text-sm text-muted-foreground">{siteMode === 'allow' ? i18n.t('allowEmpty') : siteMode === 'exclude' ? i18n.t('excludeEmpty') : i18n.t('allEmpty')}</p>}
        </Row>
      </section>
      <RememberedSitesSection prefs={sitePrefs} disabled={disabled} onForget={site => void save({ sitePrefs: forgetSitePref(sitePrefs, site) })} onClear={() => save({ sitePrefs: clearRememberedSites(sitePrefs) })} host={currentHost} readHost={readCurrentHost} />
      <BackupSection disabled={disabled} save={save} />
      {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
      <p className="px-1 text-xs leading-5 text-muted-foreground md:hidden">{i18n.t('localOnly')}</p>
    </main>
  </div>;
}
