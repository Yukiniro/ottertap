import { useState } from 'react';
import { Sun, Moon, Monitor, Globe, AppWindow, X, Check, CircleCheck, Database, ArrowLeft, CircleAlert } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Brand } from './brand';
import { useSettings } from '../hooks/use-settings';
import { normalizeDomain } from '../lib/settings';
import type { SettingsStore } from '../lib/types';

const categories = [
  { id: 'appearance', label: '外观', description: '选择小獭的显示方式。', icon: Sun },
  { id: 'floating', label: '浮动工具', description: '把页面音量控制留在手边。', icon: AppWindow },
  { id: 'sites', label: '网站规则', description: '决定小獭在哪些网页上工作。', icon: Globe }
] as const;

export function SettingsPage({ store, back }: { store: SettingsStore; back?: () => void }) {
  const { settings, update, loading, error } = useSettings(store);
  const [category, setCategory] = useState<(typeof categories)[number]['id']>('sites');
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = categories.find(item => item.id === category)!;
  const save: typeof update = async next => {
    setSaving(true); setSaved(false);
    const ok = await update(next);
    setSaving(false); setSaved(ok);
    return ok;
  };
  const addSite = async () => {
    try {
      const domain = normalizeDomain(input);
      if (settings.sites.includes(domain)) { setInputError('这个网站已经在列表中。'); return; }
      if (await save({ ...settings, sites: [...settings.sites, domain] })) { setInput(''); setInputError(''); }
    } catch (err) { setInputError(err instanceof Error ? err.message : '域名无效。'); }
  };
  const disabled = loading || saving;

  return <div className="settings-page">
    <aside className="settings-sidebar">
      <Brand />
      <p className="sidebar-caption">设置</p>
      <nav aria-label="设置分类">{categories.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className="settings-category" aria-current={category === id ? 'page' : undefined} aria-controls="settings-properties" onClick={() => setCategory(id)}><Icon /><span>{label}</span></Button>)}</nav>
      <div className="sidebar-meta">
        {back && <Button variant="ghost" className="settings-back" onClick={back}><ArrowLeft />返回控制面板</Button>}
        <div className="local-note"><Database /><p>所有设置仅保存在本地<br />不会上传到任何服务器</p></div>
      </div>
    </aside>
    <main id="settings-properties" className="settings-content" aria-labelledby="settings-category-title">
      <header className="settings-title"><div><h1 id="settings-category-title">{current.label}</h1><p>{current.description}</p></div><span className="save-state" data-error={!!error} role="status">{error ? <CircleAlert /> : <CircleCheck />}{loading ? '正在读取…' : saving ? '正在保存…' : error ? '未保存' : saved ? '已保存' : '更改自动保存'}</span></header>
      {category === 'appearance' && <section className="property-row" aria-labelledby="theme-label"><h2 id="theme-label">主题模式</h2><div><div className="theme-options" role="group" aria-label="主题">{([{ value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }, { value: 'system', label: '跟随系统', icon: Monitor }] as const).map(({ value, label, icon: Icon }) => <Button key={value} variant="outline" className="theme-option" aria-pressed={settings.theme === value} disabled={disabled} onClick={() => void save({ ...settings, theme: value })}><Icon /><span>{label}</span>{settings.theme === value && <Check className="selected-check" />}</Button>)}</div><p className="field-hint">弹出面板与浮动工具使用相同的主题。</p></div></section>}
      {category === 'floating' && <section className="property-row" aria-labelledby="floating-label"><h2 id="floating-label">页面浮动工具</h2><div><div className="setting-switch-row"><label htmlFor="settings-floating">在网页上显示入口</label><Switch id="settings-floating" aria-label="页面浮动控制器" checked={settings.floating} disabled={disabled} onCheckedChange={checked => void save({ ...settings, floating: checked })} /></div><p className="field-hint">发现媒体时显示。点击入口展开音量药丸，拖动入口移动。<br />点击页面其他位置或按 Esc 收起。</p></div></section>}
      {category === 'sites' && <>
        <section className="property-row" aria-labelledby="site-mode-label"><h2 id="site-mode-label">启用范围</h2><fieldset className="site-modes" disabled={disabled}><legend className="sr-only">网站启用规则</legend>{([{ value: 'all', label: '全部网站', description: '在所有可访问的网页上启用。' }, { value: 'allow', label: '仅指定网站', description: '仅在下方列表中的网站上启用。' }, { value: 'exclude', label: '排除指定网站', description: '在所有网站上启用，但在下方列表中的网站上不启用。' }] as const).map(mode => <label key={mode.value} className="site-mode"><input type="radio" name="site-mode" value={mode.value} checked={settings.siteMode === mode.value} onChange={() => void save({ ...settings, siteMode: mode.value })} /><span><strong>{mode.label}</strong><small>{mode.description}</small></span></label>)}</fieldset></section>
        <section className="property-row site-list-row" aria-labelledby="site-list-label"><h2 id="site-list-label">网站列表</h2><div><form className="add-site" onSubmit={event => { event.preventDefault(); void addSite(); }}><label className="sr-only" htmlFor="site-domain">网站域名</label><input id="site-domain" type="text" value={input} disabled={disabled} placeholder="输入网站域名或网址" aria-invalid={!!inputError} aria-describedby={inputError ? 'domain-error' : 'domain-tip'} onChange={event => { setInput(event.target.value); setInputError(''); }} /><Button type="submit" disabled={disabled || !input.trim()}>添加</Button></form>{inputError && <p className="input-error" id="domain-error" role="alert">{inputError}</p>}<p className="field-hint" id="domain-tip">规则包含子域名，不区分路径。</p><div className="site-list">{settings.sites.length ? settings.sites.map(site => <div className="site-item" key={site}><Globe /><span>{site}</span><Button variant="ghost" size="icon" aria-label={'移除 ' + site} disabled={disabled} onClick={() => void save({ ...settings, sites: settings.sites.filter(value => value !== site) })}><X /></Button></div>) : <p className="no-sites">{settings.siteMode === 'allow' ? '添加第一个网站后，小獭才会启用。' : settings.siteMode === 'exclude' ? '列表为空，当前所有网站均启用。' : '暂未添加网站。全部网站模式无需配置列表。'}</p>}</div></div></section>
      </>}
      {error && <div className="error-message" role="alert"><CircleAlert />{error}</div>}
    </main>
  </div>;
}
