// Profiles: whole setups kept under a name and an icon of the user's choosing, one per game or task, in this browser.
// The mouse holds one setup at a time, so loading a profile puts its settings in the draft like any other edit, and
// nothing reaches the mouse until Apply. A profile keeps the same parts a backup does (backup/format.js).
import { settingsOf } from '../backup/format.js';

const KEY = 'pilotfish.profiles';
export const PROFILE_ICONS = ['home', 'gamepad', 'bullseye-arrow', 'trophy', 'tournament', 'chess', 'dice', 'downasaur', 'car', 'human-run',
  'music', 'headphone', 'movie', 'code', 'paint-bucket', 'briefcase', 'book', 'coffee', 'moon-stars', 'heart'];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (Array.isArray(saved?.list)) return { list: saved.list, applied: saved.applied ?? null };
  } catch { /* nothing kept */ }
  return { list: [], applied: null };
}

const saved = load();
// applied: the profile last written to the mouse; draft: the one loaded into the draft (the same, unless the user
// loaded another and hasn't applied it).
export const profiles = $state({ list: saved.list, applied: saved.applied, draft: saved.applied });

function store() {
  try { localStorage.setItem(KEY, JSON.stringify({ list: $state.snapshot(profiles.list), applied: profiles.applied })); } catch { /* this visit only */ }
}

export const byId = id => profiles.list.find(p => p.id === id) ?? null;

// The first time Pilotfish reads a mouse, its setup becomes the first profile, so the menu is never empty.
export function seed(profile, name) {
  if (profiles.list.length) return;
  const id = `p${Date.now()}`;
  profiles.list.push({ id, name, icon: 'home', at: Date.now(), settings: settingsOf($state.snapshot(profile)) });
  profiles.applied = profiles.draft = id;
  store();
}

export function create(name, icon, profile) {
  const id = `p${Date.now()}`;
  profiles.list.push({ id, name, icon, at: Date.now(), settings: settingsOf($state.snapshot(profile)) });
  store();
  return id;
}

export function edit(id, name, icon) {
  const p = byId(id);
  if (!p) return;
  Object.assign(p, { name, icon });
  store();
}

export function remove(id) {
  if (profiles.list.length < 2) return;
  profiles.list = profiles.list.filter(p => p.id !== id);
  if (profiles.applied === id) profiles.applied = profiles.list[0].id;
  if (profiles.draft === id) profiles.draft = profiles.applied;
  store();
}

export function markApplied(id = profiles.draft) {
  profiles.applied = profiles.draft = id;
  store();
}
