// What the screen shows right now, apart from the mouse's settings: which face of the mouse is up, the part or level
// whose card is open, Test, the drawers and popovers. Shared by the stage, the header and the dock.
import { MediaQuery } from 'svelte/reactivity';

export const view = $state({
  face: 'top',      // top | under
  open: null,       // { kind: 'part', id, sub } or { kind: 'level', id }
  hover: null,      // the part under the pointer, lit with its callout
  testing: false,
  turning: false,
  drawer: null,     // history | settings
  pop: null,        // profiles | status
  welcome: false,   // the first-run sheet
  dock: 0,          // the DPI dock's height, which the mouse and its callouts stay clear of
});

// The parts, named as they are printed on the mouse; side is where their callout sits.
export const PARTS = {
  left: { face: 'top', side: 'l', icon: 'mouse' },
  forward: { face: 'top', side: 'l', icon: 'arrow-right' },
  back: { face: 'top', side: 'l', icon: 'arrow-left' },
  wheel: { face: 'top', side: 'r', icon: 'scroll-vertical' },
  right: { face: 'top', side: 'r', icon: 'mouse' },
  led: { face: 'top', side: 'r', icon: 'lightbulb-on' },
  usbc: { face: 'under', side: 'l', icon: 'link' },
  pair: { face: 'under', side: 'l', icon: 'radio-signal' },
  dpi: { face: 'under', side: 'l', icon: 'repeat' },
  bay: { face: 'under', side: 'l', icon: 'luggage' },
  power: { face: 'under', side: 'r', icon: 'power' },
  sensor: { face: 'under', side: 'r', icon: 'speed-fast' },
  contacts: { face: 'under', side: 'r', icon: 'battery-charging' },
};
export const FACE_ORDER = { top: ['left', 'forward', 'back', 'wheel', 'right', 'led'], under: ['usbc', 'pair', 'dpi', 'bay', 'power', 'sensor', 'contacts'] };
// As a list (phones) the parts read in order of use rather than by side.
export const LIST_ORDER = { top: ['left', 'right', 'wheel', 'forward', 'back', 'led'], under: ['dpi', 'pair', 'power', 'sensor', 'contacts', 'bay', 'usbc'] };

// Three widths: desktop; tablet (the header in two rows and cards as sheets, the callouts still round the mouse);
// phone (the parts as tiles).
export const narrow = new MediaQuery('max-width: 899px');
export const phone = new MediaQuery('max-width: 739px');
export const compact = () => narrow.current;
export const listMode = () => phone.current;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function openPart(id) {
  if (view.testing || view.turning) return;
  view.open = view.open?.kind === 'part' && view.open.id === id ? null : { kind: 'part', id, sub: 'wheel' };
}
export function openLevel(i) {
  if (view.testing) return;
  view.open = view.open?.kind === 'level' && view.open.id === i ? null : { kind: 'level', id: i };
}
export const closeCard = () => { view.open = null; };
