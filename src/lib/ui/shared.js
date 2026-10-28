// Labels, limits and helpers every screen shares. Words come from i18n; this file only says which ones.
import { t } from '../i18n/index.svelte.js';

export { clock, fmt } from '../i18n/index.svelte.js';

export const NATIVE_MAX = 12000; // PAW3311; above this the firmware asks for half and doubles it
export const PRESET_COLORS = ['#ff0000', '#ff4000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff'];

export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Mirrors protocol.snapDpi so the UI never shows a value the sensor would round differently.
export function snapDpi(dpi) {
  const v = Math.max(50, Math.min(22000, Math.round(dpi) || 50));
  if (v <= 10000) return Math.round(v / 50) * 50;
  if (v <= NATIVE_MAX) return Math.round(v / 100) * 100;
  return Math.min(22000, Math.round(v / 200) * 200);
}
export const dpiStep = v => (v >= NATIVE_MAX ? 200 : v >= 10000 ? 100 : 50);
export const isDoubled = v => v > NATIVE_MAX;

/* ---------- Connection ---------- */
export const linkName = kind => (kind ? t(`link.${kind}`) : null);
export const LOW_BATTERY = 20;
export function batteryText(b) {
  if (!b) return null;
  if (b.state === 'charging') return t('battery.charging', b);
  if (b.state === 'full') return t('battery.full');
  return t('battery.level', b);
}
export const buttonName = id => t(`button.${id}`);

/* ---------- Buttons ---------- */
export const FACTORY = { left: 2, right: 3, wheel: 4, forward: 6, back: 5, dpi: 13, 'wheel-up': 10, 'wheel-down': 9 };
// Each button's macro slot is its position in the button table plus one (as the official app numbers them).
export const MACRO_IDS = { left: 1, right: 2, wheel: 3, dpi: 6, forward: 7, back: 8, 'wheel-down': 17, 'wheel-up': 18 };

// What a button can do, grouped like the official app. Values are the firmware's [function, p1, p2]; each label
// is the i18n key `act.<name>`, the function code for plain functions.
export const ACTIONS = [
  ['mouse', [[2], [3], [4], [5], [6], [7], [8]]],
  ['wheel', [[10], [9], [11], [12]]],
  ['dpi', [[13], [14], [15]]],
  ['media', [[24], [23], [22], [26], [27], [28]]],
  ['shortcuts', [[17, 1, 6, 'copy'], [17, 1, 25, 'paste'], [17, 1, 27, 'cut'], [17, 1, 29, 'undo'],
    [17, 4, 43, 'switchWindow'], [17, 8, 7, 'desktop'], [17, 10, 22, 'snip'], [17, 8, 15, 'lock']]],
  ['browser', [[33], [32], [36]]],
  ['other', [[43], [1]]],
].map(([group, items]) => [group, items.map(([f, p1 = 0, p2 = 0, name = f]) => ({ key: `act.${name}`, raw: [f, p1, p2] }))]);
const ACTION_LIST = ACTIONS.flatMap(([, items]) => items);

// Key combinations: modifiers are Ctrl 1, Shift 2, Alt 4, Win 8; keys are USB HID usage IDs.
const MODS = [[1, 'Ctrl'], [2, 'Shift'], [4, 'Alt'], [8, 'Win']];
const KEY_USAGE = { Enter: 40, Escape: 41, Backspace: 42, Tab: 43, Space: 44, Minus: 45, Equal: 46, PrintScreen: 70,
  Insert: 73, Home: 74, PageUp: 75, Delete: 76, End: 77, PageDown: 78, ArrowRight: 79, ArrowLeft: 80, ArrowDown: 81, ArrowUp: 82,
  ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227, ControlRight: 228, ShiftRight: 229, AltRight: 230, MetaRight: 231 };
export function usageFromCode(code) {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3) - 65 + 4;
  if (/^Digit[1-9]$/.test(code)) return +code[5] + 29;
  if (code === 'Digit0') return 39;
  if (/^F([1-9]|1[0-2])$/.test(code)) return +code.slice(1) + 57;
  return KEY_USAGE[code] ?? null;
}
export function modsFromEvent(e) {
  return (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
}
export function keyLabel(usage) {
  if (usage >= 4 && usage <= 29) return String.fromCharCode(65 + usage - 4);
  if (usage >= 30 && usage <= 38) return String(usage - 29);
  if (usage === 39) return '0';
  if (usage >= 58 && usage <= 69) return `F${usage - 57}`;
  // Names that read the same everywhere; the rest depend on the language (Backspace / Retroceso, …).
  const names = { 40: 'Enter', 41: 'Esc', 43: 'Tab', 45: '-', 46: '=', 73: 'Insert', 79: '→', 80: '←', 81: '↓', 82: '↑',
    224: 'Ctrl', 225: 'Shift', 226: 'Alt', 227: 'Win' };
  if (usage in names) return names[usage];
  const local = t(`key.${usage}`);
  return local === `key.${usage}` ? t('key.other', { n: usage }) : local;
}
export function actionLabel(raw) {
  const known = ACTION_LIST.find(a => same(a.raw, raw));
  if (known) return t(known.key);
  if (raw[0] === 17) return [...MODS.filter(([bit]) => raw[1] & bit).map(([, n]) => n), keyLabel(raw[2])].join(' + ');
  if (raw[0] === 18) return t('act.macro');
  const plain = t(`act.${raw[0]}`);
  return plain === `act.${raw[0]}` ? t('act.function', { fn: raw[0] }) : plain;
}
export const isListed = raw => ACTION_LIST.some(a => same(a.raw, raw));

/* ---------- Light ---------- */
// In the official app's order; the firmware stores the position. Which controls each mode uses (names and notes
// are `lightMode.<n>` in i18n):
export const LIGHT = [
  {},
  { color: true, brightness: true },
  { color: true, brightness: true, speed: true },
  { brightness: true, speed: true },
  { brightness: true, speed: true },
  { brightness: true },
  { brightness: true, speed: true },
];
