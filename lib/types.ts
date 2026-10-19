export type Theme = 'light' | 'dark' | 'system';
export type SiteMode = 'all' | 'allow' | 'exclude';
export type DockSide = 'left' | 'right';
export interface FloatingPosition { side: DockSide; y: number }
export interface SitePref { volume?: number; rate?: number }
export interface Settings { theme: Theme; floating: boolean; floatingPosition: FloatingPosition; siteMode: SiteMode; sites: string[]; sitePrefs: Record<string, SitePref> }
export const defaultSettings: Settings = { theme: 'system', floating: true, floatingPosition: { side: 'right', y: .8 }, siteMode: 'all', sites: [], sitePrefs: {} };
export interface SettingsStore {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  watch(callback: (settings: Settings) => void): () => void;
}
export type PipBlock = '' | 'audio' | 'unsupported' | 'disabled';
export interface MediaState {
  id: string;
  title: string;
  label: string;
  host: string;
  kind: 'audio' | 'video';
  paused: boolean;
  muted: boolean;
  volume: number;
  maxVolume: number;
  rate: number;
  currentTime: number;
  duration: number | null;
  live: boolean;
  seekable: { start: number; end: number }[];
  pip: boolean;
  pipAvailable: boolean;
  pipBlock: PipBlock;
  frameId?: number;
}
export type MediaCommand =
  | { type: 'play' | 'pause' | 'mute' | 'pip' }
  | { type: 'seek' | 'skip' | 'volume' | 'rate'; value: number };
export interface PageState { host: string; enabled: boolean; media: MediaState[]; selectedId: string }
export interface MediaClient {
  read(): Promise<PageState>;
  command(media: MediaState, command: MediaCommand): Promise<void>;
  select(id: string): Promise<void>;
  highlight(media: MediaState): Promise<void>;
}
