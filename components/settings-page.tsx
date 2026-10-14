import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Sun, Moon, Monitor, Globe, AppWindow, X, Check, CircleCheck, ArrowLeft, CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle } from './ui/field';
import { Input } from './ui/input';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from './ui/item';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Brand } from './brand';
import { normalizeDomain } from '../lib/settings';
import type { Settings } from '../lib/types';
import { useSettingsAtoms } from './theme';

const categories = [
  { id: 'appearance', label: '外观', description: '选择小獭的显示方式。', icon: Sun },
  { id: 'floating', label: '浮动控制器', description: '启用后在网页上显示，关闭后隐藏。', icon: AppWindow },
  { id: 'sites', label: '网站规则', description: '决定小獭在哪些网页上工作。', icon: Globe }
] as const;
type Category = (typeof categories)[number]['id'];
const themes = [{ value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }, { value: 'system', label: '跟随系统', icon: Monitor }] as const;
const siteModes = [{ value: 'all', label: '全部网站', description: '在所有可访问的网页上启用。' }, { value: 'allow', label: '仅指定网站', description: '仅在下方列表中的网站上启用。' }, { value: 'exclude', label: '排除指定网站', description: '在所有网站上启用，但在下方列表中的网站上不启用。' }] as const;

function PropertyRow({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section className="grid gap-4 border-b py-7 sm:grid-cols-[108px_minmax(0,1fr)] md:py-10 lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-6" aria-labelledby={id}>
    <h2 id={id} className="text-lg font-semibold">{title}</h2>
    <div className="min-w-0">{children}</div>
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
  const [category, setCategory] = useState<Category>('sites');
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = categories.find(item => item.id === category)!;
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

  return <Tabs orientation="vertical" value={category} onValueChange={value => setCategory(value as Category)} className="min-h-screen gap-0 max-md:flex-col">
    <aside className="flex shrink-0 flex-col border-b bg-[color-mix(in_srgb,var(--background),var(--muted)_16%)] px-4 pt-5 pb-3 md:sticky md:top-0 md:h-screen md:min-h-110 md:w-50 md:border-r md:border-b-0 md:px-3 md:pt-8 md:pb-7 lg:w-60">
      <Brand className="text-2xl md:h-11 md:px-4 md:text-3xl md:[&>img]:size-10" />
      <p className="mx-4 mt-7 mb-4 text-muted-foreground max-md:hidden">设置</p>
      <TabsList className="h-auto w-full gap-0.5 bg-transparent p-0 no-scrollbar max-md:mt-4 max-md:flex-row max-md:justify-start max-md:overflow-x-auto">
        {categories.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} className="h-11 flex-none gap-2 px-3 max-md:w-auto! text-sm font-normal text-foreground md:h-14 md:gap-4 md:px-4 md:text-lg data-active:bg-accent data-active:font-semibold data-active:text-accent-foreground data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-accent dark:data-active:text-accent-foreground [&_svg:not([class*='size-'])]:size-5"><Icon /><span>{label}</span></TabsTrigger>)}
      </TabsList>
      {back && <div className="md:mt-auto md:px-1 md:pt-5">
        <Button variant="ghost" className="mt-3 text-muted-foreground md:mt-0" onClick={back}><ArrowLeft />返回控制面板</Button>
      </div>}
    </aside>
    <main className="max-w-[1100px] min-w-0 flex-1 px-5 pt-7 pb-10 md:px-7 md:pt-10 lg:pt-14 lg:pr-9 lg:pl-12">
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-b pb-7">
        <div>
          <h1 className="text-[28px] leading-[38px] font-bold tracking-tight md:text-[32px] md:leading-11">{current.label}</h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">{current.description}</p>
        </div>
        <Badge variant={error ? 'destructive' : 'secondary'} role="status" className="mt-3 h-6 px-2.5 text-sm">{error ? <CircleAlert /> : <CircleCheck />}{loading ? '正在读取…' : saving ? '正在保存…' : error ? '未保存' : saved ? '已保存' : '更改自动保存'}</Badge>
      </header>
      <TabsContent value="appearance">
        <PropertyRow id="theme-label" title="主题模式">
          <ToggleGroup aria-labelledby="theme-label" variant="outline" spacing={2.5} className="flex-wrap" value={[theme]} disabled={disabled} onValueChange={value => { const next = value[0] as Settings['theme'] | undefined; if (next) void save({ theme: next }); }}>
            {themes.map(({ value, label, icon: Icon }) => <ToggleGroupItem key={value} value={value} size="lg" className="h-13 gap-2 px-4 aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground [&_svg:not([class*='size-'])]:size-5"><Icon /><span>{label}</span>{theme === value && <Check className="size-4" />}</ToggleGroupItem>)}
          </ToggleGroup>
          <FieldDescription className="mt-3">弹出面板与浮动控制器使用相同的主题。</FieldDescription>
        </PropertyRow>
      </TabsContent>
      <TabsContent value="floating">
        <PropertyRow id="floating-label" title="浮动控制器">
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="settings-floating" className="text-base font-normal">在网页上显示浮动入口</FieldLabel>
            <Switch id="settings-floating" aria-label="浮动控制器" checked={floating} disabled={disabled} onCheckedChange={checked => void save({ floating: checked })} />
          </Field>
        </PropertyRow>
      </TabsContent>
      <TabsContent value="sites">
        <PropertyRow id="site-mode-label" title="启用范围">
          <RadioGroup aria-labelledby="site-mode-label" className="gap-3" value={siteMode} disabled={disabled} onValueChange={value => void save({ siteMode: value as Settings['siteMode'] })}>
            {siteModes.map(mode => <FieldLabel key={mode.value} htmlFor={'site-mode-' + mode.value}>
              <Field orientation="horizontal">
                <RadioGroupItem value={mode.value} id={'site-mode-' + mode.value} />
                <FieldContent><FieldTitle className="text-base">{mode.label}</FieldTitle><FieldDescription>{mode.description}</FieldDescription></FieldContent>
              </Field>
            </FieldLabel>)}
          </RadioGroup>
        </PropertyRow>
        <PropertyRow id="site-list-label" title="网站列表">
          <form onSubmit={event => { event.preventDefault(); void addSite(); }}>
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
        </PropertyRow>
      </TabsContent>
      {error && <Alert variant="destructive" className="mt-4"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
    </main>
  </Tabs>;
}
