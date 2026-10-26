import { normalizeSettings } from './settings';
import type { Settings } from './types';

export const settingsBackupFormat = 'ottertap-settings';
/** Current export format. Bump this when the file shape changes. */
export const settingsBackupVersion = 1;

export const settingsBackupErrors = {
  invalidJson: 'invalid-json',
  notOttertap: 'not-ottertap',
  versionTooNew: 'version-too-new',
  versionTooOld: 'version-too-old'
} as const;

export type SettingsBackupError = (typeof settingsBackupErrors)[keyof typeof settingsBackupErrors];
export type SettingsBackupResult = { ok: true; settings: Settings } | { ok: false; error: SettingsBackupError };

type ManifestRuntime = { getManifest?: () => { version?: unknown } };

function runtimeVersion(runtime: ManifestRuntime | undefined) {
  if (!runtime?.getManifest) return '';
  try {
    const version = runtime.getManifest().version;
    return typeof version === 'string' ? version.trim() : '';
  } catch {
    return '';
  }
}

export function readExtensionVersion() {
  const scope = globalThis as { browser?: { runtime?: ManifestRuntime }; chrome?: { runtime?: ManifestRuntime } };
  return runtimeVersion(scope.browser?.runtime) || runtimeVersion(scope.chrome?.runtime) || '0.0.0';
}

export function settingsBackupFilename(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `ottertap-settings-${year}-${month}-${day}.json`;
}

export function serializeSettings(settings: Settings, extensionVersion: string) {
  return JSON.stringify({
    format: settingsBackupFormat,
    version: settingsBackupVersion,
    extensionVersion,
    settings: normalizeSettings(settings)
  }, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseSettingsBackup(text: string): SettingsBackupResult {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { ok: false, error: settingsBackupErrors.invalidJson }; }
  if (!isRecord(value) || value.format !== settingsBackupFormat || typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    return { ok: false, error: settingsBackupErrors.notOttertap };
  }
  if (value.version > settingsBackupVersion) return { ok: false, error: settingsBackupErrors.versionTooNew };
  if (value.version < settingsBackupVersion) return { ok: false, error: settingsBackupErrors.versionTooOld };
  if (!isRecord(value.settings)) return { ok: false, error: settingsBackupErrors.notOttertap };
  return { ok: true, settings: normalizeSettings(value.settings) };
}

export function downloadSettingsBackup(settings: Settings, extensionVersion: string, now = new Date()) {
  const filename = settingsBackupFilename(now);
  const url = URL.createObjectURL(new Blob([serializeSettings(settings, extensionVersion)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
