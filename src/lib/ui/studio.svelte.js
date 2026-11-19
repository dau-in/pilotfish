// What the user is editing, shared by the whole app: a draft of the mouse's profile that is only written when they
// press Apply. The draft follows the mouse (DPI button presses, …) while it holds no edits.
import { applyButtons, applyDpi, applyLight, applyPolling, mouse } from '../device/mouse.svelte.js';
import { remember } from '../backup/backups.svelte.js';
import { AREAS, draftFrom, settingsOf } from '../backup/format.js';
import { MouseError } from '../protocol/index.js';
import { byId, markApplied, profiles, seed } from './profiles.svelte.js';
import { t } from '../i18n/index.svelte.js';
import { same } from './shared.js';

export const studio = $state({
  draft: null,
  busy: false,
  progress: null, // while applying: { area, i, n }
  // What happened last: { key: 'saved' | 'restored' | 'undone' | 'failed', at, err }. The header words it.
  done: null,
  undo: null, // the settings the last change replaced, while it can still be undone
});

// What the user can edit, split by the report that writes it.
const parts = settingsOf;
export const changed = key => Boolean(mouse.profile && studio.draft && !same(parts(studio.draft)[key], parts(mouse.profile)[key]));
export const isDirty = () => AREAS.some(changed);

// Each edit waiting to be applied, by name, for the header's count and its tooltip.
export function pending() {
  const d = studio.draft, p = mouse.profile;
  if (!d || !p) return [];
  const out = [];
  d.levels.forEach((l, i) => { if (l.dpi !== p.levels[i].dpi || l.color !== p.levels[i].color) out.push(t('change.level', { n: i + 1 })); });
  if (d.activeLevel !== p.activeLevel) out.push(t('change.active'));
  if (d.angleSnap !== p.angleSnap) out.push(t('sensor.snap'));
  if (d.ripple !== p.ripple) out.push(t('sensor.ripple'));
  d.buttons?.forEach((b, i) => { if (!same(b.raw, p.buttons?.[i]?.raw)) out.push(t(`button.${b.id}`)); });
  if (!same(d.lighting, p.lighting)) out.push(t('part.led'));
  if (d.sleepMinutes !== p.sleepMinutes) out.push(t('power.sleep'));
  if (d.keyResponseMs !== p.keyResponseMs) out.push(t('power.response'));
  if (d.pollingHz !== p.pollingHz) out.push(t('polling.title'));
  return out;
}

// The profile the draft was taken from: its edits are judged against that one, not the read that just arrived.
let base = null;
const hasEdits = () => Boolean(base && studio.draft) && AREAS.some(k => !same(parts(studio.draft)[k], parts(base)[k]));

// Called whenever the mouse's profile changes. While saving, the draft is left alone: the reads in between may
// still show the old values, and replacing the draft with them made the screen jump back to the old colour.
// apply() takes the draft from the mouse itself once the change is confirmed.
export function follow(profile, firstName) {
  if (!profile) { studio.draft = null; base = null; studio.undo = null; return; }
  // The first read after connecting is backed up: if anything else changed the mouse since, that setup is kept.
  if (!base) { remember(profile, 'found'); seed(profile, firstName); }
  const edited = hasEdits();
  base = $state.snapshot(profile);
  if (!studio.busy && (!studio.draft || !edited)) studio.draft = $state.snapshot(profile);
}

export function discard() {
  studio.draft = $state.snapshot(mouse.profile);
  profiles.draft = profiles.applied;
}

// Puts a profile's settings in the draft. Areas the link cannot write (polling over Bluetooth, buttons it could not
// read) are left as they are.
export function loadProfile(id) {
  const p = byId(id);
  if (!p || !mouse.profile || studio.busy) return;
  studio.draft = draftFrom($state.snapshot(mouse.profile), p.settings, { polling: mouse.canChangePolling });
  profiles.draft = id;
  if (!isDirty()) markApplied(id);
}

// reason: saved (the user's edits), restored (a backup) or undone (the previous change taken back).
export async function apply(reason = 'saved') {
  const d = studio.draft;
  if (studio.busy || !isDirty()) return;
  studio.busy = true;
  studio.done = null;
  const before = $state.snapshot(mouse.profile);
  const steps = [
    ['buttons', () => {
      if (!d.buttons.some(b => b.raw[0] === 2)) throw new MouseError('leftClickRequired');
      return applyButtons(Object.fromEntries(d.buttons.map(b => [b.id, b.raw])));
    }, changed('buttons')],
    ['light', () => applyLight({ ...d.lighting, sleepMinutes: d.sleepMinutes, keyResponseMs: d.keyResponseMs }), changed('power') || changed('light')],
    ['polling', () => applyPolling(d.pollingHz), changed('polling')],
    ['dpi', () => applyDpi({ levels: d.levels, activeLevel: d.activeLevel, angleSnap: d.angleSnap, ripple: d.ripple }), changed('dpi')],
  ].filter(s => s[2]);
  try {
    // The setup being replaced is in the timeline before a single byte changes.
    await remember(before, 'found');
    for (const [i, [area, run]] of steps.entries()) {
      studio.progress = { area, i, n: steps.length };
      await run();
    }
    studio.draft = $state.snapshot(mouse.profile);
    studio.undo = reason === 'undone' ? null : settingsOf(before);
    markApplied();
    studio.done = { key: reason, at: new Date() };
  } catch (err) {
    studio.done = { key: 'failed', at: new Date(), err };
  } finally {
    // Whatever the mouse holds now, even after a change that only half landed.
    remember(mouse.profile, reason);
    studio.progress = null;
    studio.busy = false;
  }
}

// Puts a backup's settings in the draft and applies them like any edit.
export async function restore(settings, reason = 'restored') {
  if (studio.busy || !mouse.profile) return;
  studio.draft = draftFrom($state.snapshot(mouse.profile), settings, { polling: mouse.canChangePolling });
  await apply(reason);
}

export async function undo() {
  if (studio.undo && !isDirty()) await restore(studio.undo, 'undone');
}

// A macro is written to the mouse as soon as it is saved (it has its own report); its button then points at it.
// The draft follows, so the button's new assignment isn't shown as a change waiting.
export function macroSaved(button, raw) {
  const b = studio.draft?.buttons?.find(x => x.id === button);
  if (b) b.raw = raw;
}
