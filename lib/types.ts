import { defaultKeybinds, type Keybinds } from './keybinds';
import { defaultRatePresets, defaultRateStep, type RateStep } from './rate';
export { rateSteps, type RateStep } from './rate';

export type Theme = 'light' | 'dark' | 'system';
export type SiteMode = 'all' | 'allow' | 'exclude';
export type DockSide = 'left' | 'right';
export interface FloatingPosition { side: DockSide; y: number }
/**
 * What the floating entry shows beside the button.
 * Stored on `ottertap-settings-v1.floatingNote`. Missing or unknown values stay `volume`.
 * `volume` shows the percent, and shows speed instead when that percent is 100 and speed is not 1×.
 * `rate` always shows speed. `off` hides the note.
 * This is not the toolbar badge, which is only the bare number above 100%, and it is not per-site.
 */
export const floatingNotes = ['volume', 'rate', 'off'] as const;
export type FloatingNote = (typeof floatingNotes)[number];
export type ChannelMode = 'stereo' | 'mono' | 'left' | 'right';
/** Stereo is the default and is never stored. */
export interface SitePref { volume?: number; rate?: number; channel?: Exclude<ChannelMode, 'stereo'> }
export const skipSteps = [5, 10, 15, 30] as const;
export type SkipSeconds = (typeof skipSteps)[number];
export const volumeSteps = [5, 10, 20] as const;
export type VolumeStep = (typeof volumeSteps)[number];
/** `up` keeps scroll-up as a volume increase. `down` flips only hover-wheel and Alt+wheel. */
export const wheelDirections = ['up', 'down'] as const;
export type WheelDirection = (typeof wheelDirections)[number];
/**
 * `floatingHiddenSites` only hides the floating entry on those domains and their subdomains.
 * It is separate from `siteMode` / `sites`, which turn the whole extension on or off for a site.
 */
export interface Settings { theme: Theme; floating: boolean; floatingPosition: FloatingPosition; floatingNote: FloatingNote; floatingWhilePlaying: boolean; floatingHiddenSites: string[]; siteMode: SiteMode; sites: string[]; sitePrefs: Record<string, SitePref>; ratePresets: number[]; defaultRate: number | null; lockRate: boolean; holdBoost: boolean; holdBoostRate: number; holdSkip: boolean; hoverWheel: boolean; singleKey: boolean; skipSeconds: SkipSeconds; skipWithRate: boolean; volumeStep: VolumeStep; fineWheel: boolean; wheelDirection: WheelDirection; rateStep: RateStep; keybinds: Keybinds }
export const defaultSettings: Settings = { theme: 'system', floating: true, floatingPosition: { side: 'right', y: .8 }, floatingNote: 'volume', floatingWhilePlaying: false, floatingHiddenSites: [], siteMode: 'all', sites: [], sitePrefs: {}, ratePresets: [...defaultRatePresets], defaultRate: null, lockRate: false, holdBoost: false, holdBoostRate: 2, holdSkip: false, hoverWheel: true, singleKey: false, skipSeconds: 10, skipWithRate: false, volumeStep: 10, fineWheel: true, wheelDirection: 'up', rateStep: defaultRateStep, keybinds: { ...defaultKeybinds } };
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
  | { type: 'channel'; value: ChannelMode }
  | { type: 'frame'; direction: 1 | -1 };
export interface PageState { host: string; enabled: boolean; media: MediaState[]; selectedId: string }
export interface MediaClient {
  read(): Promise<PageState>;
  command(media: MediaState, command: MediaCommand): Promise<void>;
  select(id: string): Promise<void>;
  highlight(media: MediaState): Promise<void>;
}
