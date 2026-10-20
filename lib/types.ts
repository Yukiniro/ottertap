import { defaultRatePresets } from './rate';

export type Theme = 'light' | 'dark' | 'system';
export type SiteMode = 'all' | 'allow' | 'exclude';
export type DockSide = 'left' | 'right';
export interface FloatingPosition { side: DockSide; y: number }
export type ChannelMode = 'stereo' | 'mono' | 'left' | 'right';
/** Stereo is the default and is never stored. */
export interface SitePref { volume?: number; rate?: number; channel?: Exclude<ChannelMode, 'stereo'> }
export interface Settings { theme: Theme; floating: boolean; floatingPosition: FloatingPosition; siteMode: SiteMode; sites: string[]; sitePrefs: Record<string, SitePref>; ratePresets: number[]; lockRate: boolean; hoverWheel: boolean; singleKey: boolean }
export const defaultSettings: Settings = { theme: 'system', floating: true, floatingPosition: { side: 'right', y: .8 }, siteMode: 'all', sites: [], sitePrefs: {}, ratePresets: [...defaultRatePresets], lockRate: false, hoverWheel: true, singleKey: false };
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
  channel: ChannelMode;
  /** False when routing through Web Audio would silence the media, as with cross-origin media without CORS. */
  channelAvailable: boolean;
  /** Set when rate lock has surrendered on this element. */
  rateLock?: 'given-up';
  frameId?: number;
}
export type MediaCommand =
  | { type: 'play' | 'pause' | 'mute' | 'pip' }
  | { type: 'seek' | 'skip' | 'volume' | 'rate'; value: number }
  | { type: 'channel'; value: ChannelMode };
export interface PageState { host: string; enabled: boolean; media: MediaState[]; selectedId: string }
export interface MediaClient {
  read(): Promise<PageState>;
  command(media: MediaState, command: MediaCommand): Promise<void>;
  select(id: string): Promise<void>;
  highlight(media: MediaState): Promise<void>;
}
