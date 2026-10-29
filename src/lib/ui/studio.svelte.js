// What the user is editing, shared by every screen: a draft of the mouse's profile that is only written when they
// press "Apply". The draft follows the mouse (DPI button presses, …) while it holds no edits.
import { applyButtons, applyDpi, applyLight, applyPolling, mouse } from '../device/mouse.svelte.js';
import { remember } from '../backup/backups.svelte.js';
import { AREAS, draftFrom, settingsOf } from '../backup/format.js';
import { MouseError } from '../protocol/index.js';
import { clock, errorText, t } from '../i18n/index.svelte.js';
import { same } from './shared.js';

export const studio = $state({
  draft: null,
  editing: 1, // DPI level shown in the editor
  busy: false,
  stamp: { key: null, at: null, err: null }, // the line under the actions: what happened last, and when
  undo: null, // the settings the last change replaced, while it can still be undone
});

// What the user can edit, split by the report that writes it.
const parts = settingsOf;
export const changed = key => Boolean(mouse.profile && studio.draft && !same(parts(studio.draft)[key], parts(mouse.profile)[key]));
export const isDirty = () => AREAS.some(changed);

// The stamp keeps the event, not its words, so it follows a change of language.
export function setStamp(key, { at = null, err = null } = {}) { studio.stamp = { key, at, err }; }
export const stampText = s => (s.key ? t(s.key, { time: s.at && clock(s.at), msg: s.err && errorText(s.err) }) : '');
const DONE = { saved: 'stamp.saved', restored: 'stamp.restored', undone: 'stamp.undone' };
const lasting = key => Object.values(DONE).includes(key);

// The profile the draft was taken from: its edits are judged against that one, not the read that just arrived.
let base = null;
const hasEdits = () => Boolean(base && studio.draft) && AREAS.some(k => !same(parts(studio.draft)[k], parts(base)[k]));

// Called whenever the mouse's profile changes. While saving, the draft is left alone: the reads in between may
// still show the old values, and replacing the draft with them made the screen jump back to the old colour.
// apply() takes the draft from the mouse itself once the change is confirmed.
export function follow(profile) {
  if (!profile) { studio.draft = null; base = null; studio.undo = null; return; }
  // The first read after connecting is backed up: if anything else changed the mouse since, that setup is kept.
  if (!base) remember(profile, 'found');
  const edited = hasEdits();
  base = $state.snapshot(profile);
  if (!studio.draft) studio.editing = profile.activeLevel;
  if (!studio.busy && (!studio.draft || !edited)) studio.draft = $state.snapshot(profile);
  if (!studio.busy && !studio.stamp.err && !lasting(studio.stamp.key)) {
    setStamp('stamp.read', { at: mouse.readAt ?? new Date() });
  }
}

export function discard() { studio.draft = $state.snapshot(mouse.profile); }

// reason: saved (the user's edits), restored (a backup) or undone (the previous change taken back).
export async function apply(reason = 'saved') {
  const d = studio.draft;
  if (studio.busy || !isDirty()) return;
  studio.busy = true;
  setStamp('stamp.saving');
  const before = $state.snapshot(mouse.profile);
  try {
    // The setup being replaced is in the timeline before a single byte changes.
    await remember(before, 'found');
    if (changed('buttons')) {
      if (!d.buttons.some(b => b.raw[0] === 2)) throw new MouseError('leftClickRequired');
      await applyButtons(Object.fromEntries(d.buttons.map(b => [b.id, b.raw])));
    }
    if (changed('power') || changed('light')) {
      await applyLight({ ...d.lighting, sleepMinutes: d.sleepMinutes, keyResponseMs: d.keyResponseMs });
    }
    if (changed('polling')) await applyPolling(d.pollingHz);
    if (changed('dpi')) {
      const { levels, activeLevel, angleSnap, ripple } = d;
      await applyDpi({ levels, activeLevel, angleSnap, ripple });
    }
    studio.draft = $state.snapshot(mouse.profile);
    studio.undo = reason === 'undone' ? null : settingsOf(before);
    setStamp(DONE[reason], { at: new Date() });
  } catch (err) {
    setStamp('stamp.failed', { err });
  } finally {
    // Whatever the mouse holds now, even after a change that only half landed.
    remember(mouse.profile, reason);
    studio.busy = false;
  }
}

// Puts a backup's settings in the draft and applies them like any edit. Areas the link cannot write (polling over
// Bluetooth, buttons it could not read) are left as they are.
export async function restore(settings, reason = 'restored') {
  if (studio.busy || !mouse.profile) return;
  studio.draft = draftFrom($state.snapshot(mouse.profile), settings, { polling: mouse.canChangePolling });
  await apply(reason);
}

export async function undo() {
  if (studio.undo && !isDirty()) await restore(studio.undo, 'undone');
}
