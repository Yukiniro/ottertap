export type Theme = 'light' | 'dark' | 'system';
export type SiteMode = 'all' | 'allow' | 'exclude';
export interface Settings { theme: Theme; floating: boolean; siteMode: SiteMode; sites: string[] }
export const defaultSettings: Settings = { theme: 'system', floating: true, siteMode: 'all', sites: [] };
export interface SettingsStore {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  watch(callback: (settings: Settings) => void): () => void;
}
export interface MediaState {
  id: string;
  title: string;
  host: string;
  kind: 'audio' | 'video';
  paused: boolean;
  muted: boolean;
  volume: number;
  rate: number;
  currentTime: number;
  duration: number | null;
  live: boolean;
  seekable: { start: number; end: number }[];
  frameId?: number;
}
export type MediaCommand =
  | { type: 'play' | 'pause' | 'mute' }
  | { type: 'seek' | 'skip' | 'volume' | 'rate'; value: number };
export interface PageState { host: string; enabled: boolean; media: MediaState[] }
export interface MediaClient {
  read(): Promise<PageState>;
  command(media: MediaState, command: MediaCommand): Promise<void>;
}
