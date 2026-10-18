import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export function changelogEntry(markdown, version) {
  const heading = `## ${version}`;
  const start = markdown.split('\n').findIndex(line => line.trim() === heading);
  if (start < 0) throw new Error(`CHANGELOG 里没有 ${version}`);
  const lines = markdown.split('\n').slice(start);
  const next = lines.findIndex((line, index) => index > 0 && line.startsWith('## '));
  return lines.slice(0, next < 0 ? undefined : next).join('\n').trim();
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function releaseExists(tag) {
  try { execFileSync('gh', ['release', 'view', tag], { cwd: root, stdio: 'ignore' }); return true; }
  catch { return false; }
}

function tagExists(tag) {
  try { execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { cwd: root, stdio: 'ignore' }); return true; }
  catch { return false; }
}

export function assertZipHasLicense(entries) {
  if (!entries.includes('LICENSE')) throw new Error('ZIP 缺少 LICENSE');
}

function zipEntries(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
}

function main() {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const tag = `v${version}`;
  if (releaseExists(tag)) { console.log(`${tag} 已发布`); return; }
  run('pnpm', ['build']);
  run('pnpm', ['verify-build']);
  run('pnpm', ['zip']);
  const zips = readdirSync(new URL('../.output/', import.meta.url)).filter(name => name.endsWith('.zip'));
  if (zips.length !== 1) throw new Error(`需要恰好一个 zip，实际是 ${zips.join(', ') || '没有'}`);
  assertZipHasLicense(zipEntries(join(root, '.output', zips[0])));
  if (!tagExists(tag)) run('git', ['tag', tag]);
  try { execFileSync('git', ['push', 'origin', `refs/tags/${tag}`], { cwd: root, stdio: 'inherit' }); }
  catch { execFileSync('git', ['ls-remote', '--exit-code', 'origin', `refs/tags/${tag}`], { cwd: root, stdio: 'ignore' }); }
  const notes = join(tmpdir(), `ottertap-${version}.md`);
  writeFileSync(notes, changelogEntry(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), version));
  run('gh', ['release', 'create', tag, join(root, '.output', zips[0]), '--title', tag, '--notes-file', notes]);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
