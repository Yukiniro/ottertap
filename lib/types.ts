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
/** `up` keeps scroll-up as volume-up. `down` makes scroll-down volume-up. Missing values stay `up`. */
export const wheelDirections = ['up', 'down'] as const;
export type WheelDirection = (typeof wheelDirections)[number];
/**
 * `floatingHiddenSites` only hides the floating entry on those domains and their subdomains.
 * It is separate from `siteMode` / `sites`, which turn the whole extension on or off for a site.
 */
/**
 * `fullscreenWheel` limits the bare hover wheel to fullscreen. Missing or unusable values stay off, so today's hover wheel remains.
 * Alt+wheel ignores it. On includes the Fullscreen API, browser fullscreen, and a web fullscreen that can be recognized reliably.
 */
/**
 * `followPlaying` switches the selection when a different media on the page starts playing.
 * Missing values stay on. A manual pick from the panel keeps that media for a few seconds.
 */
export interface Settings { theme: Theme; floating: boolean; floatingPosition: FloatingPosition; floatingNote: FloatingNote; floatingWhilePlaying: boolean; followPlaying: boolean; floatingHiddenSites: string[]; siteMode: SiteMode; sites: string[]; sitePrefs: Record<string, SitePref>; ratePresets: number[]; defaultRate: number | null; lockRate: boolean; holdBoost: boolean; holdBoostRate: number; holdSkip: boolean; hoverWheel: boolean; fullscreenWheel: boolean; singleKey: boolean; skipSeconds: SkipSeconds; skipWithRate: boolean; volumeStep: VolumeStep; coarseStep: VolumeStep; fineWheel: boolean; wheelDirection: WheelDirection; rateStep: RateStep; keybinds: Keybinds }
export const defaultSettings: Settings = { theme: 'system', floating: true, floatingPosition: { side: 'right', y: .8 }, floatingNote: 'volume', floatingWhilePlaying: false, followPlaying: true, floatingHiddenSites: [], siteMode: 'all', sites: [], sitePrefs: {}, ratePresets: [...defaultRatePresets], defaultRate: null, lockRate: false, holdBoost: false, holdBoostRate: 2, holdSkip: false, hoverWheel: true, fullscreenWheel: false, singleKey: false, skipSeconds: 10, skipWithRate: false, volumeStep: 10, coarseStep: 20, fineWheel: true, wheelDirection: 'up', rateStep: defaultRateStep, keybinds: { ...defaultKeybinds } };
export interface SettingsStore {
  load(): Promise<Settings>;
  /** Merge against the baseline, or replace the full value when importing a backup. */
  save(settings: Settings, previous: Settings, replace?: boolean): Promise<void>;
  watch(callback: (settings: Settings) => void): () => void;
}
export type PipBlock = '' | 'audio' | 'unsupported' | 'disabled' | 'not-ready';
export interface MediaState {
  id: string;
  title: string;
  label: string;
  /**
   * Filename stem from the media address, without directory or query.
   * Empty when the address is missing, a blob, or a data URL.
   * The panel list uses it only when the element has no title or accessible name.
   */
  file?: string;
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
  /**
   * Horizontal flip of this video element on the current page.
   * Absent or false means off. A newly selected element stays off until its own toggle.
   * Never stored in `sitePrefs`.
   */
  mirrored?: boolean;
  /**
   * One progress mark for this element, in seconds.
   * Absent when unset. Lives only in the page session for this element, never in extension storage.
   */
  mark?: number;
  /** Set when rate lock has surrendered on this element. */
  rateLock?: 'given-up';
  frameId?: number;
}
export type MediaCommand =
  | { type: 'play' | 'pause' | 'mute' | 'pip' }
  | { type: 'seek' | 'skip' | 'volume' | 'rate'; value: number }
  | { type: 'channel'; value: ChannelMode }
  | { type: 'mirror'; value: boolean }
  | { type: 'frame'; direction: 1 | -1 }
  | { type: 'mark'; action: 'set' | 'jump' | 'clear' };
export interface PageState { host: string; enabled: boolean; media: MediaState[]; selectedId: string }
export interface MediaClient {
  read(): Promise<PageState>;
  command(media: MediaState, command: MediaCommand): Promise<void>;
  /** `manual` is a pick from the panel. Auto-follow yields for a few seconds after it. */
  select(id: string, manual?: boolean): Promise<void>;
  highlight(media: MediaState): Promise<void>;
}
