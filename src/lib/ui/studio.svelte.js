// What the user is editing, shared by every screen: a draft of the mouse's profile that is only written when they
// press "Aplicar al mouse". The draft follows the mouse (DPI button presses, …) while it holds no edits.
import { applyButtons, applyDpi, applyLight, applyPolling, mouse } from '../device/mouse.svelte.js';
import { MouseError } from '../protocol/index.js';
import { clock, errorText, t } from '../i18n/index.svelte.js';
import { same } from './shared.js';

export const studio = $state({
  draft: null,
  editing: 1, // DPI level shown in the editor
  busy: false,
  stamp: { key: null, at: null, err: null }, // the line under the actions: what happened last, and when
});

// What the user can edit, split by the report that writes it.
const parts = p => ({
  dpi: { angleSnap: p.angleSnap, ripple: p.ripple, activeLevel: p.activeLevel, levels: p.levels.map(({ dpi, color }) => ({ dpi, color })) },
  polling: p.pollingHz,
  power: { sleepMinutes: p.sleepMinutes, keyResponseMs: p.keyResponseMs },
  light: p.lighting,
  buttons: (p.buttons ?? []).map(b => b.raw),
});
export const changed = key => Boolean(mouse.profile && studio.draft && !same(parts(studio.draft)[key], parts(mouse.profile)[key]));
export const isDirty = () => ['dpi', 'polling', 'power', 'light', 'buttons'].some(changed);

// The stamp keeps the event, not its words, so it follows a change of language.
export function setStamp(key, { at = null, err = null } = {}) { studio.stamp = { key, at, err }; }
export const stampText = s => (s.key ? t(s.key, { time: s.at && clock(s.at), msg: s.err && errorText(s.err) }) : '');

// The profile the draft was taken from: its edits are judged against that one, not the read that just arrived.
let base = null;
const hasEdits = () => Boolean(base && studio.draft)
  && ['dpi', 'polling', 'power', 'light', 'buttons'].some(k => !same(parts(studio.draft)[k], parts(base)[k]));

// Called whenever the mouse's profile changes. While saving, the draft is left alone: the reads in between may
// still show the old values, and replacing the draft with them made the screen jump back to the old colour.
// apply() takes the draft from the mouse itself once the change is confirmed.
export function follow(profile) {
  if (!profile) { studio.draft = null; base = null; return; }
  const edited = hasEdits();
  base = $state.snapshot(profile);
  if (!studio.draft) studio.editing = profile.activeLevel;
  if (!studio.busy && (!studio.draft || !edited)) studio.draft = $state.snapshot(profile);
  if (!studio.busy && !studio.stamp.err && studio.stamp.key !== 'stamp.saved') {
    setStamp('stamp.read', { at: mouse.readAt ?? new Date() });
  }
}

export function discard() { studio.draft = $state.snapshot(mouse.profile); }

export async function apply() {
  const d = studio.draft;
  if (studio.busy || !isDirty()) return;
  studio.busy = true;
  setStamp('stamp.saving');
  try {
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
    setStamp('stamp.saved', { at: new Date() });
  } catch (err) {
    setStamp('stamp.failed', { err });
  } finally {
    studio.busy = false;
  }
}
