import { defaultKeybinds, type Keybinds } from './keybinds';
import { defaultRatePresets, defaultRateStep, type RateStep } from './rate';
import type { SleepPreset } from './sleep-timer';
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
/**
 * `floatingSleepNote` shows the sleep countdown beside the floating entry while a timer is running.
 * Missing or non-boolean values stay off. With no timer, `floatingNote` applies again, including `off`.
 * The countdown is not stored, and it is not the toolbar badge.
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
/**
 * `sleepSoonHint` shows the short on-page note about a minute before a sleep timer pauses.
 * Missing values stay on. Starting, cancelling, and a successful pause still show their own notes.
 */
/** `sleepDefaultMinutes` is the length the sleep key and extension command start. Missing or unusable values stay 30. */
/**
 * `autoPipOnHide` lets the selected, playing video enter picture-in-picture when its tab is hidden.
 * Missing values stay off. A recent exit or a failed automatic attempt holds it back for a short cooldown.
 * Success and failure use the same short on-page notes as a manual toggle.
 */
/**
 * `autoPipOnScroll` lets the selected, playing main video enter picture-in-picture when it scrolls almost out of view.
 * Missing values stay off. It is separate from `autoPipOnHide`; fullscreen and feed cards never enter.
 */
/**
 * `autoPipExitOnReturn` closes picture-in-picture that `autoPipOnHide` or `autoPipOnScroll` opened once the tab is visible
 * and the video is back in view. Missing values stay off. Manual picture-in-picture is never closed by it.
 */
/**
 * `autoPipExcludedSites` turns every automatic picture-in-picture entry and exit off for those domains and their subdomains,
 * matched against the tab's host. Manual picture-in-picture still works there. It is separate from
 * `floatingHiddenSites` and from `siteMode` / `sites`.
 */
/**
 * `resumeJump` makes a freshly opened long media continue from its stored progress.
 * Missing values stay on. Turning it off still saves progress; the panel can still jump by hand.
 */
/**
 * `resumeExcludedSites` turns saving and jumping off for those domains and their subdomains,
 * for sites that resume playback on their own. The stored ledger keeps its old entries.
 */
export interface Settings {
  theme: Theme;
  floating: boolean;
  floatingPosition: FloatingPosition;
  floatingNote: FloatingNote;
  floatingSleepNote: boolean;
  floatingWhilePlaying: boolean;
  followPlaying: boolean;
  autoPipOnHide: boolean;
  autoPipOnScroll: boolean;
  autoPipExitOnReturn: boolean;
  autoPipExcludedSites: string[];
  sleepSoonHint: boolean;
  sleepDefaultMinutes: SleepPreset;
  floatingHiddenSites: string[];
  resumeJump: boolean;
  resumeExcludedSites: string[];
  siteMode: SiteMode;
  sites: string[];
  sitePrefs: Record<string, SitePref>;
  ratePresets: number[];
  defaultRate: number | null;
  lockRate: boolean;
  holdBoost: boolean;
  holdBoostRate: number;
  holdSkip: boolean;
  hoverWheel: boolean;
  fullscreenWheel: boolean;
  singleKey: boolean;
  skipSeconds: SkipSeconds;
  skipWithRate: boolean;
  volumeStep: VolumeStep;
  coarseStep: VolumeStep;
  fineWheel: boolean;
  wheelDirection: WheelDirection;
  rateStep: RateStep;
  keybinds: Keybinds;
}
export const defaultSettings: Settings = {
  theme: 'system',
  floating: true,
  floatingPosition: { side: 'right', y: .8 },
  floatingNote: 'volume',
  floatingSleepNote: false,
  floatingWhilePlaying: false,
  followPlaying: true,
  autoPipOnHide: false,
  autoPipOnScroll: false,
  autoPipExitOnReturn: false,
  autoPipExcludedSites: [],
  sleepSoonHint: true,
  sleepDefaultMinutes: 30,
  floatingHiddenSites: [],
  resumeJump: true,
  resumeExcludedSites: [],
  siteMode: 'all',
  sites: [],
  sitePrefs: {},
  ratePresets: [...defaultRatePresets],
  defaultRate: null,
  lockRate: false,
  holdBoost: false,
  holdBoostRate: 2,
  holdSkip: false,
  hoverWheel: true,
  fullscreenWheel: false,
  singleKey: false,
  skipSeconds: 10,
  skipWithRate: false,
  volumeStep: 10,
  coarseStep: 20,
  fineWheel: true,
  wheelDirection: 'up',
  rateStep: defaultRateStep,
  keybinds: { ...defaultKeybinds }
};
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
  /**
   * Ledger key of this media's stored progress, filled by the content script.
   * The background reads the ledger with it and answers with `resume`.
   */
  resumeKey?: string;
  /** Seconds of stored progress for this media, filled by the background for the panel. Absent when there is none. */
  resume?: number;
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
  | { type: 'mark'; action: 'set' | 'jump' | 'clear' }
  | { type: 'resume'; action: 'jump' | 'clear' };
export interface PageState {
  host: string;
  enabled: boolean;
  media: MediaState[];
  selectedId: string;
  /**
   * Epoch milliseconds when this tab's sleep timer pauses the media OtterTap controls then.
   * Absent when no timer is running. It lives in the tab's top frame, never in extension storage.
   */
  sleepAt?: number;
}
export interface MediaClient {
  read(): Promise<PageState>;
  command(media: MediaState, command: MediaCommand): Promise<void>;
  /** `manual` is a pick from the panel. Auto-follow yields for a few seconds after it. */
  select(id: string, manual?: boolean): Promise<void>;
  highlight(media: MediaState): Promise<void>;
}
