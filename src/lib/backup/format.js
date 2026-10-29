// What a backup holds and how it travels. Pure functions: no storage, no DOM, so they are tested like the protocol.
// A backup keeps only what the app can write back (the same parts the editor changes), never raw bytes: restoring
// goes through the editor and the protocol builders, which range-check every value before anything is sent.

export const AREAS = ['dpi', 'polling', 'power', 'light', 'buttons'];
export const FILE_KIND = 'pilotfish-backups';
export const FILE_VERSION = 1;

// The editable parts of a parsed profile, split by the report that writes each one. Buttons are null when the
// link could not read them.
export function settingsOf(p) {
  return {
    dpi: { angleSnap: p.angleSnap, ripple: p.ripple, activeLevel: p.activeLevel, levels: p.levels.map(({ dpi, color }) => ({ dpi, color })) },
    polling: p.pollingHz,
    power: { sleepMinutes: p.sleepMinutes, keyResponseMs: p.keyResponseMs },
    light: { mode: p.lighting.mode, color: p.lighting.color, brightness: p.lighting.brightness, speed: p.lighting.speed },
    buttons: p.buttons ? Object.fromEntries(p.buttons.map(b => [b.id, [...b.raw]])) : null,
  };
}

const json = v => JSON.stringify(v);
// The DPI button changes the active level all day long; that alone is not a different setup worth a backup.
const comparable = (s, area) => (area === 'dpi' ? { ...s.dpi, activeLevel: 0 } : s[area]);

// Areas where two backups differ. An area one of them could not read (buttons over Bluetooth) is not counted.
export function differences(a, b) {
  return AREAS.filter(area => a[area] != null && b[area] != null && json(comparable(a, area)) !== json(comparable(b, area)));
}
export const sameSettings = (a, b) => differences(a, b).length === 0;

// A draft profile that carries a backup's settings, on top of the mouse's current profile (which keeps the bytes the
// app does not edit). Areas the backup lacks, or the link cannot write, stay as they are.
export function draftFrom(profile, s, { polling = true } = {}) {
  const d = structuredClone(profile);
  d.angleSnap = s.dpi.angleSnap;
  d.ripple = s.dpi.ripple;
  d.activeLevel = s.dpi.activeLevel;
  d.levels = d.levels.map((l, i) => (s.dpi.levels[i] ? { ...l, ...s.dpi.levels[i] } : l));
  if (polling && s.polling != null) d.pollingHz = s.polling;
  Object.assign(d, s.power);
  d.lighting = { ...d.lighting, ...s.light };
  if (s.buttons && d.buttons) d.buttons = d.buttons.map(b => (s.buttons[b.id] ? { ...b, raw: [...s.buttons[b.id]] } : b));
  return d;
}

/* ---------- Files ---------- */

export function toFile(backups, at = new Date()) {
  return { kind: FILE_KIND, version: FILE_VERSION, exportedAt: at.toISOString(), backups: backups.map(clean) };
}

// Only the fields a backup has, so nothing else (ids from this browser's store) travels.
const clean = b => ({
  at: b.at, reason: b.reason, kept: Boolean(b.kept), first: Boolean(b.first), firmware: b.firmware ?? null, settings: b.settings,
});

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const REASONS = ['found', 'saved', 'restored', 'undone', 'manual'];

// Shape checks for a backup read from a file. Exact limits are the protocol's job when it is restored; this only
// keeps out anything that is not a backup at all.
function validSettings(s) {
  if (!s || typeof s !== 'object') return false;
  const { dpi, power, light, buttons } = s;
  return Boolean(dpi) && typeof dpi.angleSnap === 'boolean' && typeof dpi.ripple === 'boolean' && int(dpi.activeLevel, 1, 8)
    && Array.isArray(dpi.levels) && dpi.levels.length >= 1 && dpi.levels.length <= 8
    && dpi.levels.every(l => int(l?.dpi, 50, 26000) && isColor(l.color))
    && (s.polling === null || int(s.polling, 125, 8000))
    && Boolean(power) && int(power.sleepMinutes, 0, 255) && int(power.keyResponseMs, 0, 510)
    && Boolean(light) && int(light.mode, 0, 15) && isColor(light.color) && int(light.brightness, 0, 15) && int(light.speed, 0, 15)
    && (buttons === null || (typeof buttons === 'object' && Object.values(buttons).every(r => Array.isArray(r) && r.length === 3 && r.every(v => int(v, 0, 255)))));
}

// The backups in a file, or null when it is not one of ours. Entries that do not pass are dropped, not guessed at.
export function fromFile(data) {
  if (data?.kind !== FILE_KIND || !int(data.version, 1, FILE_VERSION) || !Array.isArray(data.backups)) return null;
  return data.backups
    .filter(b => int(b?.at, 0, 8.64e15) && validSettings(b.settings))
    .map(b => ({ ...clean(b), reason: REASONS.includes(b.reason) ? b.reason : 'manual' }));
}
