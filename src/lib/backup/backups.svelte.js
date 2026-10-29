// The backup timeline: every setup the mouse has been seen in, newest last. A setup is remembered when the app first
// reads the mouse, before and after every change it applies, and when the user asks. Identical setups in a row are
// remembered once. Restoring one is the editor's job (studio.svelte.js), so it goes through the same confirmed writes.
import { mouse } from '../device/mouse.svelte.js';
import { differences, fromFile, settingsOf, toFile } from './format.js';
import * as store from './store.js';

// Automatic backups beyond this many are dropped, oldest first. Kept ones (the first one, and any the user keeps) stay.
const MAX_AUTO = 100;

export const backups = $state({
  list: [],          // oldest first
  loaded: false,
  persisted: false,  // the browser promised not to clear them on its own
  failed: false,     // this browser has no usable storage (private window, blocked site data)
});

const ready = typeof indexedDB === 'undefined'
  ? Promise.resolve()
  : store.all()
    .then(list => { backups.list = list.sort((a, b) => a.at - b.at); })
    .then(() => navigator.storage?.persisted?.())
    .then(p => { backups.persisted = Boolean(p); })
    .catch(() => { backups.failed = true; })
    .finally(() => { backups.loaded = true; });

// Same setup as the backup, and the backup knows at least as much (buttons are unknown over Bluetooth).
const covers = (b, s) => differences(b.settings, s).length === 0 && (b.settings.buttons != null || s.buttons == null);

// One at a time, so two quick calls cannot both see the same last backup and add the same setup twice.
let queue = Promise.resolve();
export function remember(profile, reason) {
  const settings = profile && settingsOf($state.snapshot(profile));
  queue = queue.then(() => add(settings, reason)).catch(() => {});
  return queue;
}

async function add(settings, reason) {
  await ready;
  if (!settings || backups.failed) return;
  const last = backups.list.at(-1);
  if (last && covers(last, settings)) {
    if (reason === 'manual' && !last.kept) await keep(last, true);
    return;
  }
  const backup = {
    at: Date.now(), reason, settings, firmware: mouse.version,
    kept: reason === 'manual' || !backups.list.length, first: !backups.list.length,
  };
  backup.id = await store.add(backup);
  backups.list.push(backup);
  if (backup.first) backups.persisted = await store.persist().catch(() => false);
  await prune();
}

export async function keep(backup, kept) {
  const target = backups.list.find(b => b.id === backup.id);
  if (!target || target.first) return;
  target.kept = kept;
  await store.put($state.snapshot(target));
}

async function prune() {
  const auto = backups.list.filter(b => !b.kept);
  const drop = auto.slice(0, Math.max(0, auto.length - MAX_AUTO)).map(b => b.id);
  if (!drop.length) return;
  await store.remove(drop);
  backups.list = backups.list.filter(b => !drop.includes(b.id));
}

/* ---------- Files ---------- */

export function exportAll() {
  const data = toFile($state.snapshot(backups.list));
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `pilotfish-backups-${data.exportedAt.slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Adds a file's backups to the timeline, skipping ones already in it. Returns how many were added, or null when the
// file is not a Pilotfish backup file.
export async function importFile(file) {
  await ready;
  let incoming;
  try { incoming = fromFile(JSON.parse(await file.text())); } catch { incoming = null; }
  if (!incoming) return null;
  const known = new Set(backups.list.map(b => `${b.at}:${JSON.stringify(b.settings)}`));
  const fresh = incoming.filter(b => !known.has(`${b.at}:${JSON.stringify(b.settings)}`));
  // Imported backups are kept: they were worth exporting, so they are not pruned away as automatic ones.
  for (const b of fresh) {
    const backup = { ...b, kept: true, first: false };
    backup.id = await store.add(backup);
    backups.list.push(backup);
  }
  backups.list.sort((a, b) => a.at - b.at);
  return fresh.length;
}
