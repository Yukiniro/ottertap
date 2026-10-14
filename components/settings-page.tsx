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

const themes = [{ value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }, { value: 'system', label: '跟随系统', icon: Monitor }] as const;
const siteModes = [{ value: 'all', label: '全部网站', description: '在所有可访问的网页上启用。' }, { value: 'allow', label: '仅指定网站', description: '仅在下方列表中的网站上启用。' }, { value: 'exclude', label: '排除指定网站', description: '在所有网站上启用，但在下方列表中的网站上不启用。' }] as const;

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
      if (sites.includes(domain)) { setInputError('这个网站已经在列表中。'); return; }
      if (await save({ sites: [...sites, domain] })) { setInput(''); setInputError(''); }
    } catch (err) { setInputError(err instanceof Error ? err.message : '域名无效。'); }
  };
  const disabled = loading || saving;

  return <div className="mx-auto min-h-screen w-full max-w-3xl px-5 pt-7 pb-12 md:px-8 md:pt-10">
    <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-b pb-7">
      <div className="min-w-0">
        {back && <Button variant="ghost" className="-ml-2.5 mb-4 text-muted-foreground" onClick={back}><ArrowLeft />返回控制面板</Button>}
        <Brand />
        <h1 className="mt-5 text-[28px] leading-[38px] font-bold tracking-tight">设置</h1>
      </div>
      <Badge variant={error ? 'destructive' : 'secondary'} role="status" className="mt-3 h-6 px-2.5 text-sm">{error ? <CircleAlert /> : <CircleCheck />}{loading ? '正在读取…' : saving ? '正在保存…' : error ? '未保存' : saved ? '已保存' : '更改自动保存'}</Badge>
    </header>
    <Section id="theme-label" title="外观" description="弹出面板与浮动控制器使用相同的主题。">
      <ToggleGroup aria-labelledby="theme-label" variant="outline" spacing={2.5} className="flex-wrap" value={[theme]} disabled={disabled} onValueChange={value => { const next = value[0] as Settings['theme'] | undefined; if (next) void save({ theme: next }); }}>
        {themes.map(({ value, label, icon: Icon }) => <ToggleGroupItem key={value} value={value} size="lg" className="h-13 gap-2 px-4 aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground [&_svg:not([class*='size-'])]:size-5"><Icon /><span>{label}</span>{theme === value && <Check className="size-4" />}</ToggleGroupItem>)}
      </ToggleGroup>
    </Section>
    <Section id="floating-label" title="浮动控制器" description="启用后在网页上显示，关闭后隐藏。">
      <Field orientation="horizontal" className="justify-between">
        <FieldLabel htmlFor="settings-floating" className="text-base font-normal">在网页上显示浮动入口</FieldLabel>
        <Switch id="settings-floating" aria-label="浮动控制器" checked={floating} disabled={disabled} onCheckedChange={checked => void save({ floating: checked })} />
      </Field>
    </Section>
    <Section id="sites-label" title="网站规则" description="决定小獭在哪些网页上工作。">
      <h3 id="site-mode-label" className="text-sm font-medium">启用范围</h3>
      <RadioGroup aria-labelledby="site-mode-label" className="mt-3 gap-3" value={siteMode} disabled={disabled} onValueChange={value => void save({ siteMode: value as Settings['siteMode'] })}>
        {siteModes.map(mode => <FieldLabel key={mode.value} htmlFor={'site-mode-' + mode.value}>
          <Field orientation="horizontal">
            <RadioGroupItem value={mode.value} id={'site-mode-' + mode.value} />
            <FieldContent><FieldTitle className="text-base">{mode.label}</FieldTitle><FieldDescription>{mode.description}</FieldDescription></FieldContent>
          </Field>
        </FieldLabel>)}
      </RadioGroup>
      <h3 id="site-list-label" className="mt-8 text-sm font-medium">网站列表</h3>
      <form className="mt-3" onSubmit={event => { event.preventDefault(); void addSite(); }}>
        <Field data-invalid={!!inputError}>
          <FieldLabel htmlFor="site-domain" className="sr-only">网站域名</FieldLabel>
          <div className="flex gap-3 max-sm:flex-col">
            <Input id="site-domain" className="h-12 flex-1 px-4 md:text-base" value={input} disabled={disabled} placeholder="输入网站域名或网址" aria-invalid={!!inputError} aria-describedby={inputError ? 'domain-error' : 'domain-tip'} onChange={event => { setInput(event.target.value); setInputError(''); }} />
            <Button type="submit" className="h-12 px-8 text-base" disabled={disabled || !input.trim()}>添加</Button>
          </div>
          <FieldError id="domain-error">{inputError}</FieldError>
          <FieldDescription id="domain-tip">规则包含子域名，不区分路径。</FieldDescription>
        </Field>
      </form>
      {sites.length
        ? <ItemGroup aria-label="网站列表" className="mt-6 gap-0 border-t">{sites.map(site => <Item key={site} role="listitem" className="rounded-none border-b-border px-0 sm:px-4">
          <ItemMedia variant="icon" className="text-muted-foreground"><Globe className="size-5" /></ItemMedia>
          <ItemContent><ItemTitle className="line-clamp-none text-base font-normal break-all">{site}</ItemTitle></ItemContent>
          <ItemActions><Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={'移除 ' + site} disabled={disabled} onClick={() => void save({ sites: sites.filter(value => value !== site) })}><X /></Button></ItemActions>
        </Item>)}</ItemGroup>
        : <p className="mt-6 border-y px-2 py-6 text-sm text-muted-foreground">{siteMode === 'allow' ? '添加第一个网站后，小獭才会启用。' : siteMode === 'exclude' ? '列表为空，当前所有网站均启用。' : '暂未添加网站。全部网站模式无需配置列表。'}</p>}
    </Section>
    {error && <Alert variant="destructive" className="mt-4"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
