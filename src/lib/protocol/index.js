// Attack Shark X11 configuration protocol (feature reports on interface MI_02 / COL04).
// Decoded from the official web driver and verified against traces of the official app;
// docs/protocol.md has the full write-up.

// PAW3311 register values, indexed by DPI step. Indices 0..199 cover 50..10000 in steps of 50
// (DPI-Y byte = 0); indices 200..219 cover 10100..12000 in steps of 100 (DPI-Y byte = 1).
// Copied verbatim from the official driver (`mo`).
const SENSOR_TABLE = [
  1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32,
  34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 47, 48, 49, 50, 51, 52, 54, 55, 56, 57, 58, 59, 61, 62, 63,
  64, 65, 67, 68, 69, 70, 71, 72, 74, 75, 76, 77, 78, 79, 81, 82, 83, 84, 85, 87, 88, 89, 90, 91, 92, 94,
  95, 96, 97, 98, 99, 101, 102, 103, 104, 105, 107, 108, 109, 110, 111, 112, 114, 115, 116, 117, 118,
  119, 121, 122, 123, 124, 125, 127, 128, 129, 130, 131, 132, 134, 135, 136, 137, 138, 139, 141, 142,
  143, 144, 145, 147, 148, 149, 150, 151, 152, 154, 155, 156, 157, 158, 159, 161, 162, 163, 164, 165,
  167, 168, 169, 170, 171, 172, 174, 175, 176, 177, 178, 179, 181, 182, 183, 184, 185, 187, 188, 189,
  190, 191, 192, 194, 195, 196, 197, 198, 199, 201, 202, 203, 204, 205, 207, 208, 209, 210, 211, 212,
  214, 215, 216, 217, 218, 219, 221, 222, 223, 224, 225, 227, 228, 229, 230, 231, 232, 234, 235, 118,
  119, 121, 122, 123, 124, 125, 127, 128, 129, 130, 131, 132, 134, 135, 136, 137, 138, 139, 141,
];
const HIGH_RANGE_START = 200;

export const DPI_MIN = 50;
export const DPI_MAX = 22000;
export const DPI_LEVELS = 6;
export const POLLING_RATES = { 125: 8, 250: 4, 500: 2, 1000: 1 };

// Errors the app can explain: `code` names the problem and `vars` its details, so the UI can say it in the
// user's language (see i18n errorText). The message is the code, for logs and tests.
export class MouseError extends Error {
  constructor(code, vars = {}) {
    super(code);
    this.name = 'MouseError';
    this.code = code;
    this.vars = vars;
  }
}

const REPORT = { DPI: 0x04, POWER: 0x05, POLLING: 0x06, BUTTONS: 0x08, PROFILE: 0x0a, VERSION: 0x0b, STATUS: 0xa0 };

// Read requests go through the status report (0xA0): request, poll status, then fetch the report.
export const REQUEST_VERSION = [REPORT.STATUS, REPORT.VERSION, 0x08, 0, 0, 0, 0, 0];
export const REQUEST_PROFILE = [REPORT.STATUS, REPORT.PROFILE, 0x80, 0x00, 0x01, 0, 0, 0];
export const STATUS_READY = 0x01;
export { REPORT };

// Rounds a DPI value to what the sensor can actually do (50 steps up to 10000, 100 up to 12000,
// and 200 above that, where the firmware doubles a 100-step value).
export function snapDpi(dpi) {
  const v = Math.max(DPI_MIN, Math.min(DPI_MAX, Math.round(dpi)));
  if (v <= 10000) return Math.round(v / 50) * 50;
  if (v <= 12000) return Math.round(v / 100) * 100;
  return Math.min(DPI_MAX, Math.round(v / 200) * 200);
}

// Returns { x, y, doubled } register bytes for a DPI value.
export function encodeDpi(dpi) {
  let v = snapDpi(dpi);
  const doubled = v > 12000;
  if (doubled) v /= 2;
  const index = v <= 10000 ? (v - 50) / 50 : HIGH_RANGE_START - 1 + (v - 10000) / 100;
  return { x: SENSOR_TABLE[index], y: v <= 10000 ? 0 : 1, doubled };
}

export function decodeDpi(x, y, doubled) {
  const [from, to] = y === 0 ? [0, HIGH_RANGE_START] : [HIGH_RANGE_START, SENSOR_TABLE.length];
  const index = SENSOR_TABLE.indexOf(x, from);
  if (index < 0 || index >= to) return null;
  const v = index < HIGH_RANGE_START ? 50 + index * 50 : 10000 + (index - HIGH_RANGE_START + 1) * 100;
  return doubled ? v * 2 : v;
}

const hex = n => n.toString(16).padStart(2, '0');
const rgb = (b, o) => '#' + hex(b[o]) + hex(b[o + 1]) + hex(b[o + 2]);

// Profile report (0x0A), 128 bytes. Offsets are into the raw report (byte 0 = report id).
const P = {
  polling: 3, pollingCheck: 4,
  dpiBlock: 5, // angle snap .. indication type: the body of the DPI write packet
  angleSnap: 5, ripple: 6, levelMask: 7, xDouble: 8, yDouble: 9, dpiX: 10, dpiY: 18, activeLevel: 26,
  colors: 27, indication: 51, dpiBlockEnd: 52,
  lightMode: 55, breathing: 56, brightness: 57, lightRgb: 58, sleepRaw: 61, response: 62,
  lightBlock: 55, lightBlockEnd: 63, // the body of the 0x05 write
};

export function parseProfile(raw) {
  const b = Uint8Array.from(raw);
  if (b[0] !== REPORT.PROFILE || b[1] !== 0x80) throw new MouseError('badProfile');
  const pollingHz = Number(Object.keys(POLLING_RATES).find(hz => POLLING_RATES[hz] === b[P.polling])) || null;
  const levels = [];
  for (let i = 0; i < DPI_LEVELS; i++) {
    levels.push({
      dpi: decodeDpi(b[P.dpiX + i], b[P.dpiY + i], (b[P.xDouble] >> i) & 1),
      color: rgb(b, P.colors + i * 3),
      enabled: Boolean((b[P.levelMask] >> i) & 1),
    });
  }
  return {
    pollingHz,
    angleSnap: b[P.angleSnap] === 1,
    ripple: b[P.ripple] === 1,
    activeLevel: b[P.activeLevel],
    levels,
    // The X11 packs the sleep timer into the high nibbles of breathing speed and brightness.
    sleepMinutes: (b[P.breathing] & 0xf0) | ((b[P.brightness] & 0xf0) >> 4),
    keyResponseMs: b[P.response] * 2,
    lighting: {
      mode: b[P.lightMode] >> 4, color: rgb(b, P.lightRgb),
      brightness: b[P.brightness] & 0x0f, speed: b[P.breathing] & 0x0f,
    },
    // Kept so writes can preserve bytes we do not edit (levels 7-8, indication type, ...).
    dpiBlock: Array.from(b.slice(P.dpiBlock, P.dpiBlockEnd)),
    lightBlock: Array.from(b.slice(P.lightBlock, P.lightBlockEnd)),
    ...(b.length >= BUTTONS_END + 2 ? parseButtons(b) : { buttons: null, buttonSlots: null }),
  };
}

/* ---------- Buttons (second half of the profile, same layout as the 0x08 write) ---------- */

// The profile carries 18 slots of [function, p1, p2] from byte 65, then their 16-bit sum (little endian).
const BUTTONS_START = 65;
const BUTTON_SLOT_COUNT = 18;
const BUTTONS_END = BUTTONS_START + BUTTON_SLOT_COUNT * 3;

// Slots the X11 really has, in the official driver's order (`al` in the bundle). The rest stay empty.
export const BUTTON_SLOTS = [
  { slot: 0, id: 'left', name: 'Left button', factory: 2 },
  { slot: 1, id: 'right', name: 'Right button', factory: 3 },
  { slot: 2, id: 'wheel', name: 'Wheel click', factory: 4 },
  { slot: 6, id: 'forward', name: 'Forward side button', factory: 6 },
  { slot: 7, id: 'back', name: 'Back side button', factory: 5 },
  { slot: 5, id: 'dpi', name: 'DPI button', factory: 13 },
  { slot: 17, id: 'wheel-up', name: 'Wheel up', factory: 10 },
  { slot: 16, id: 'wheel-down', name: 'Wheel down', factory: 9 },
];

// Function codes (`sl` in the bundle). English names for logs and scripts; the app labels them itself.
const FUNCTIONS = {
  0: null, 1: 'Off', 2: 'Left click', 3: 'Right click', 4: 'Middle click', 5: 'Back', 6: 'Forward',
  7: 'Double click', 8: 'Rapid fire', 9: 'Scroll down', 10: 'Scroll up', 11: 'Tilt left',
  12: 'Tilt right', 13: 'DPI cycle', 14: 'DPI up', 15: 'DPI down', 16: 'Easy aim', 18: 'Macro',
  19: 'Open program', 20: 'Windows key', 21: 'Media player', 22: 'Previous track', 23: 'Next track',
  24: 'Play / pause', 25: 'Stop', 26: 'Mute', 27: 'Volume up', 28: 'Volume down',
  29: 'Calculator', 30: 'Mail', 32: 'Browser forward', 33: 'Browser back', 34: 'Browser stop',
  35: 'This PC', 36: 'Browser reload', 37: 'Browser home', 38: 'Browser search', 40: 'Polling rate cycle',
  41: 'Lighting cycle', 43: 'Show battery', 52: 'Profile cycle', 53: 'Next profile', 54: 'Previous profile',
  60: 'Mode key',
};
const COMBINATION = 17;
const MODIFIERS = [[1, 'Ctrl'], [2, 'Shift'], [4, 'Alt'], [8, 'Win']];

// USB HID keyboard usage IDs → key names, for key combinations.
function keyName(usage) {
  if (usage >= 4 && usage <= 29) return String.fromCharCode(65 + usage - 4);
  if (usage >= 30 && usage <= 38) return String(usage - 29);
  if (usage >= 58 && usage <= 69) return `F${usage - 57}`;
  return {
    39: '0', 40: 'Enter', 41: 'Esc', 42: 'Backspace', 43: 'Tab', 44: 'Space', 45: '-', 46: '=', 70: 'Print Screen',
    73: 'Insert', 74: 'Home', 75: 'Page Up', 76: 'Delete', 77: 'End', 78: 'Page Down', 79: '→', 80: '←', 81: '↓', 82: '↑',
  }[usage] ?? `key 0x${hex(usage)}`;
}

export function describeFunction([fn, p1, p2]) {
  if (fn === COMBINATION) {
    const mods = MODIFIERS.filter(([bit]) => p1 & bit).map(([, n]) => n);
    return [...mods, keyName(p2)].join(' + ');
  }
  if (fn === 18) return `Macro ${p2}`;
  return fn in FUNCTIONS ? FUNCTIONS[fn] : `Function 0x${hex(fn)}`;
}

function parseButtons(b) {
  const sum = b.slice(BUTTONS_START, BUTTONS_END).reduce((a, v) => a + v, 0);
  const stored = b[BUTTONS_END] | (b[BUTTONS_END + 1] << 8);
  // A torn read: better to show nothing than the wrong mapping.
  if ((sum & 0xffff) !== stored) return { buttons: null, buttonSlots: null };
  const buttonSlots = [];
  for (let i = 0; i < BUTTON_SLOT_COUNT; i++) buttonSlots.push(Array.from(b.slice(BUTTONS_START + i * 3, BUTTONS_START + i * 3 + 3)));
  return { buttons: describeButtons(buttonSlots), buttonSlots };
}

export function describeButtons(slots) {
  return BUTTON_SLOTS.map(({ slot, id, name, factory }) => {
    const raw = slots[slot];
    return { id, name, raw, action: describeFunction(raw), factory: raw[0] === factory && !raw[1] && !raw[2] };
  });
}

export const FACTORY_BUTTONS = Object.fromEntries(BUTTON_SLOTS.map(b => [b.id, [b.factory, 0, 0]]));
const LEFT_CLICK = 2;
const OFF = [1, 0, 0];

// Builds the button write (report 0x08) from the slots last read plus { buttonId: [fn, p1, p2] }.
// Matches the official app byte for byte: empty slots go out as "off" (01 00 00) and the sum is big endian.
export function buildButtonPacket(profile, assign = {}) {
  if (!profile.buttonSlots) throw new MouseError('buttonsUnread');
  const slots = profile.buttonSlots.map(r => r.slice());
  for (const [id, raw] of Object.entries(assign)) {
    const def = BUTTON_SLOTS.find(b => b.id === id);
    if (!def) throw new MouseError('unknownButton', { id });
    if (!Array.isArray(raw) || raw.length !== 3 || raw.some(v => !Number.isInteger(v) || v < 0 || v > 255)) {
      throw new MouseError('badAssignment', { id });
    }
    if (!(raw[0] in FUNCTIONS) && raw[0] !== COMBINATION) throw new MouseError('unknownFunction', { fn: raw[0] });
    slots[def.slot] = raw.slice();
  }
  // Never leave the mouse without a primary click.
  if (!BUTTON_SLOTS.some(b => slots[b.slot][0] === LEFT_CLICK)) throw new MouseError('leftClickRequired');
  const body = slots.flatMap(r => (r[0] === 0 ? OFF : r));
  const sum = body.reduce((a, v) => a + v, 0);
  return [REPORT.BUTTONS, 0x3b, 0x01, ...body, (sum >> 8) & 0xff, sum & 0xff];
}

/* ---------- Power: sleep timer and key response (report 0x05, shared with the lighting) ---------- */

// Minutes. The official slider starts at 1, but 1 written through the receiver made the mouse drop the link and blink
// red until the receiver was plugged in again (2026-11-19); 2 and up went through.
export const SLEEP_RANGE = [2, 60];
export const RESPONSE_RANGE = [4, 50, 2]; // ms, min / max / step

// The light modes, in the official app's order for the X11; the firmware stores the position in the high nibble.
export const LIGHT_MODES = ['Off', 'Steady', 'Breathing', 'Neon', 'Color breathing', 'Steady by DPI', 'Breathing by DPI'];
export const LIGHT_LEVEL_RANGE = [1, 8]; // brightness and speed, as the official sliders

// Report 0x05 carries the light and the power settings together:
// 05 0F 01 <mode<<4> <sleep hi | speed> <sleep lo | brightness> R G B <sleepRaw> <response/2> <sumHi> <sumLo> 00 00
export function buildLightPacket(profile, changes = {}) {
  const l = { ...profile.lighting, ...pick(changes, ['mode', 'color', 'brightness', 'speed']) };
  if (!Number.isInteger(l.mode) || l.mode < 0 || l.mode >= LIGHT_MODES.length) throw new MouseError('unknownLightMode');
  const [lo, hi] = LIGHT_LEVEL_RANGE;
  for (const k of ['brightness', 'speed']) {
    if (!Number.isInteger(l[k]) || l[k] < lo || l[k] > hi) throw new MouseError(k === 'brightness' ? 'brightnessRange' : 'speedRange', { lo, hi });
  }
  if (!/^#[0-9a-f]{6}$/i.test(l.color)) throw new MouseError('badColor');
  const packet = buildPowerPacket(profile, changes);
  packet[3] = l.mode << 4;
  packet[4] = (packet[4] & 0xf0) | l.speed;
  packet[5] = (packet[5] & 0xf0) | l.brightness;
  parseColor(l.color).forEach((v, i) => (packet[6 + i] = v));
  const sum = packet.slice(3, 11).reduce((a, v) => a + v, 0);
  packet[11] = (sum >> 8) & 0xff;
  packet[12] = sum & 0xff;
  return packet;
}
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

// The X11 keeps the sleep minutes in the high nibbles of breathing speed (x16) and brightness (x1),
// and the key response in ms/2. Every other lighting byte is copied from the device.
export function buildPowerPacket(profile, { sleepMinutes = profile.sleepMinutes, keyResponseMs = profile.keyResponseMs } = {}) {
  const [lo, hi] = SLEEP_RANGE;
  if (!Number.isInteger(sleepMinutes) || sleepMinutes < lo || sleepMinutes > hi) throw new MouseError('sleepRange', { lo, hi });
  const [rmin, rmax, rstep] = RESPONSE_RANGE;
  if (!Number.isInteger(keyResponseMs) || keyResponseMs < rmin || keyResponseMs > rmax || keyResponseMs % rstep) {
    throw new MouseError('responseRange', { lo: rmin, hi: rmax, step: rstep });
  }
  const body = profile.lightBlock.slice(); // mode, speed, brightness, R, G, B, sleepRaw, response
  body[1] = (sleepMinutes & 0xf0) | (body[1] & 0x0f);
  body[2] = ((sleepMinutes & 0x0f) << 4) | (body[2] & 0x0f);
  body[7] = keyResponseMs / 2;
  const sum = body.reduce((a, v) => a + v, 0);
  return [REPORT.POWER, 0x0f, 0x01, ...body, (sum >> 8) & 0xff, sum & 0xff, 0, 0];
}

const parseColor = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));

// Builds the DPI write (report 0x04) from the last profile read plus the requested changes.
// Unedited bytes are copied from the device so we never write values we do not understand.
export function buildDpiPacket(profile, changes = {}) {
  const body = profile.dpiBlock.slice(); // offsets below are relative to P.dpiBlock
  const o = off => off - P.dpiBlock;
  const s = { ...profile, ...changes };
  body[o(P.angleSnap)] = s.angleSnap ? 1 : 0;
  body[o(P.ripple)] = s.ripple ? 1 : 0;
  let doubled = 0;
  s.levels.forEach((level, i) => {
    const e = encodeDpi(level.dpi);
    body[o(P.dpiX) + i] = e.x;
    body[o(P.dpiY) + i] = e.y;
    if (e.doubled) doubled |= 1 << i;
    parseColor(level.color).forEach((v, k) => (body[o(P.colors) + i * 3 + k] = v));
  });
  // Like the official app, mirror the doubling flags into both X and Y.
  body[o(P.xDouble)] = doubled;
  body[o(P.yDouble)] = doubled;
  if (s.activeLevel < 1 || s.activeLevel > DPI_LEVELS) throw new MouseError('levelRange');
  body[o(P.activeLevel)] = s.activeLevel;

  const sum = body.reduce((a, v) => a + v, 0);
  return [REPORT.DPI, 0x38, 0x01, ...body, (sum >> 8) & 0xff, sum & 0xff, 0, 0, 0, 0];
}

export function buildPollingPacket(hz) {
  const rate = POLLING_RATES[hz];
  if (!rate) throw new MouseError('pollingUnsupported', { hz });
  return [REPORT.POLLING, 0x09, 0x01, rate, ~rate & 0xff, 0, 0, 0, 0];
}

export function parseVersion(raw) {
  const b = Uint8Array.from(raw);
  return `${b[2]}.${hex(b[3])}`;
}

/* ---------- Notifications (input report 3 on MI_02 / COL03) ---------- */

// Every ~2 s over the dongle the mouse sends 03 <device> 40 <state> <level>, e.g. 03 55 40 01 64 = on battery, 100%.
// State, as the official driver reads it: 1 on battery (level in %), 2 full / on cable, 3 charging.
export const X11_DEVICE_NO = 0x55;
const STATUS_CODES = new Set([0x40, 0x41]);
const BATTERY_STATE = { 1: 'battery', 2: 'full', 3: 'charging' };

// Returns { battery: { state, level } } for the status heartbeat, or null for any other notification
// (those mean something on the mouse changed, e.g. the DPI button, and call for a fresh read).
export function parseNotify(data) {
  const b = Array.from(data);
  if (b[0] !== 3 || b.length < 5 || !STATUS_CODES.has(b[2])) return null;
  const state = BATTERY_STATE[b[3]] ?? null;
  if (!state) return null;
  const level = state === 'full' ? 100 : Math.max(0, Math.min(100, b[4]));
  return { deviceNo: b[1], battery: { state, level } };
}

/* ---------- Macros (report 0x09; one slot per button, id = the button's slot + 1) ---------- */
// The macro, as read back (131 bytes):
// 09 83 <id> <mode> 00 00 00 <loops> <20 × 00> <count> <actions…> … <sumHi @129> <sumLo @130>
// Each action is [flags|delay, usage]: bit 7 = key up, bit 0 always set (as the official app writes it),
// delay in 10 ms units on the remaining bits, so in steps of 20 ms. A delay over 1270 ms takes two more bytes
// [delay / 200 ms, 3] and counts as one more action.
// Read with A0 09 83 00 <id>, then report 0x09 at 131 bytes; an empty slot reads back as ff.
// Written in pieces (probe/trace5.log): bytes 3…130 split into 60-byte chunks, each sent as
// 09 <4 + n> <id> <chunk index> <n bytes>, about half a second apart.
export const MACRO_LENGTH = 131;
export const MACRO_MODES = { times: 0, untilKey: 1, whileHeld: 2 };
export const MACRO_SLOTS = Object.fromEntries(BUTTON_SLOTS.map(b => [b.id, b.slot + 1]));
const MACRO_CHUNK = 60;
export const MACRO_MAX_DELAY = 25000; // ms; 200 ms × 127 + 1270
const MACRO_ACTIONS_START = 29;
const MACRO_SUM = 129;
export const requestMacro = id => [REPORT.STATUS, 0x09, 0x83, 0x00, id, 0, 0, 0];

export function buildMacroPacket(id, { mode = 'times', loops = 1, events = [] } = {}) {
  if (!Object.values(MACRO_SLOTS).includes(id)) throw new MouseError('macroNoButton');
  const modeCode = MACRO_MODES[mode];
  if (modeCode === undefined) throw new MouseError('macroMode');
  if (modeCode === 0 && (!Number.isInteger(loops) || loops < 1 || loops > 255)) throw new MouseError('macroLoops');
  if (!events.length) throw new MouseError('macroEmpty');
  const b = new Array(MACRO_LENGTH).fill(0);
  b[0] = 0x09; b[1] = MACRO_LENGTH; b[2] = id; b[3] = modeCode; b[7] = modeCode === 0 ? loops : 1;
  let i = MACRO_ACTIONS_START, count = 0;
  for (const e of events) {
    if (!Number.isInteger(e.usage) || e.usage < 1 || e.usage > 255) throw new MouseError('macroKey');
    // Bit 0 is always set, so delays go in steps of 20 ms.
    const ms = Math.max(0, Math.min(MACRO_MAX_DELAY, Math.round(e.delay / 20) * 20));
    const long = ms > 1270;
    const units = long ? (ms % 200) / 10 : ms / 10;
    if (i + (long ? 4 : 2) > MACRO_SUM) throw new MouseError('macroTooLong');
    b[i++] = units | 1 | (e.down ? 0 : 128);
    b[i++] = e.usage;
    if (long) { b[i++] = Math.floor(ms / 200); b[i++] = 3; count++; }
    count++;
  }
  b[28] = count;
  const sum = b.slice(3, i).reduce((a, v) => a + v, 0);
  b[MACRO_SUM] = (sum >> 8) & 0xff;
  b[MACRO_SUM + 1] = sum & 0xff;
  return b;
}

export function parseMacro(raw) {
  const b = Array.from(raw);
  if (b[0] !== 0x09) throw new MouseError('badMacro');
  if (b[3] === 0xff) return { id: b[2], empty: true, events: [] };
  const mode = Object.keys(MACRO_MODES).find(k => MACRO_MODES[k] === b[3]) ?? 'times';
  const events = [];
  for (let i = MACRO_ACTIONS_START, n = 0; n < b[28] && i + 1 < MACRO_SUM; n++) {
    const f = b[i], usage = b[i + 1];
    const down = !(f & 128);
    const delay0 = (f & 126) * 10; // bit 0 is a flag, not part of the delay
    i += 2;
    let delay = delay0;
    if (b[i + 1] === 3 && i + 1 < MACRO_SUM) { delay += b[i] * 200; i += 2; n++; }
    events.push({ usage, down, delay });
  }
  return { id: b[2], empty: false, mode, loops: b[7], events };
}

// Splits a macro (as built above) into the pieces the mouse accepts.
export function macroChunks(packet) {
  const body = packet.slice(3, MACRO_LENGTH);
  const chunks = [];
  for (let k = 0, at = 0; at < body.length; k++, at += MACRO_CHUNK) {
    const part = body.slice(at, at + MACRO_CHUNK);
    chunks.push([0x09, 4 + part.length, packet[2], k, ...part]);
  }
  return chunks;
}

/* ---------- Reads that fit in 64 bytes (WebHID cannot fetch the 128-byte profile) ---------- */

// Buttons on their own: A0 08 3B 00 01 → report 0x08 = 08 3B 01 <54 slot bytes> <sumHi> <sumLo> (big endian).
export const REQUEST_BUTTONS = [REPORT.STATUS, REPORT.BUTTONS, 0x3b, 0x00, 0x01, 0, 0, 0];
export function parseButtonReport(raw) {
  const b = Array.from(raw);
  if (b[0] !== REPORT.BUTTONS || b[1] !== 0x3b) throw new MouseError('badButtons');
  const body = b.slice(3, 3 + BUTTON_SLOT_COUNT * 3);
  const sum = body.reduce((a, v) => a + v, 0) & 0xffff;
  if (sum !== ((b[3 + body.length] << 8) | b[4 + body.length])) return { buttons: null, buttonSlots: null };
  const buttonSlots = [];
  for (let i = 0; i < BUTTON_SLOT_COUNT; i++) buttonSlots.push(body.slice(i * 3, i * 3 + 3));
  return { buttons: describeButtons(buttonSlots), buttonSlots };
}

// A macro's first 64 bytes: A0 09 40 00 <id> → header and the first 17 steps. Macros written by this app are
// kept to that length, so they always read back whole.
export const MACRO_WEB_MAX_EVENTS = 17;
export const requestMacroHead = id => [REPORT.STATUS, 0x09, 0x40, 0x00, id, 0, 0, 0];
export function parseMacroHead(raw) {
  const b = Array.from(raw);
  if (b[0] !== 0x09) throw new MouseError('badMacro');
  const full = [0x09, MACRO_LENGTH, ...b.slice(2), ...new Array(Math.max(0, MACRO_LENGTH - b.length)).fill(b[3] === 0xff ? 0xff : 0)];
  const macro = parseMacro(full);
  const room = Math.floor((b.length - MACRO_ACTIONS_START) / 2);
  return { ...macro, truncated: !macro.empty && b[28] > room };
}

/* ---------- Bluetooth (GATT service FEE0: write FEE3, answers and notices on FEE4) ---------- */

export const BLE = { SERVICE: 0xfee0, WRITE: 0xfee3, NOTIFY: 0xfee4 };
// A read is <cmd> 08 00 00 00 00 00 00 on FEE3; the answer starts with the same byte.
export const BLE_READ = { PROFILE: 0xa0, VERSION: 0xa1 };
export const bleRequest = cmd => [cmd, 0x08, 0, 0, 0, 0, 0, 0];
export const parseBleVersion = b => `${b[1]}.${hex(b[2])}`;

// The profile arrives as a0 + bytes 3… of the USB profile (118 bytes, buttons included); only the high byte of
// the button sum is missing. Rebuilt into the USB layout, every parser above applies unchanged.
export function bleProfileToReport(raw) {
  const b = Array.from(raw);
  if (b[0] !== BLE_READ.PROFILE) throw new MouseError('badProfile');
  const usb = [REPORT.PROFILE, 0x80, 0x01, ...b.slice(1)];
  while (usb.length < 128) usb.push(0);
  const sum = usb.slice(BUTTONS_START, BUTTONS_END).reduce((a, v) => a + v, 0);
  usb[BUTTONS_END + 1] = (sum >> 8) & 0xff;
  return usb;
}

// Notices on FEE4: the battery heartbeat (55 40 <state> <level>, report 3 without its id) and write
// confirmations (55 50 <status> <report>: status 0 = stored).
export function parseBleNotice(raw) {
  const b = Array.from(raw);
  if (b[0] !== X11_DEVICE_NO) return null;
  if (b[1] === 0x50) return { ack: { report: b[3], ok: b[2] === 0 } };
  // The DPI switch pressed: 55 10 <new level> 00 (seen on the owner's X11, 2026-11-19).
  if (b[1] === 0x10) return { changed: true, level: b[2] };
  return parseNotify([3, ...b]);
}

/* ---------- Did the write take? ---------- */
// Compares a fresh read with a packet that was just written. Over the receiver a write that is still on its way
// can be dropped by the next request without any error, so every write is checked this way before it counts.
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const asSlot = s => (s[0] === 0 ? [1, 0, 0] : s); // empty slots read back as 00 or as "off" (01 00 00)
export function confirms(profile, packet) {
  switch (packet[0]) {
    case REPORT.DPI: return sameBytes(profile.dpiBlock, packet.slice(3, 3 + profile.dpiBlock.length));
    case REPORT.POWER: return sameBytes(profile.lightBlock, packet.slice(3, 3 + profile.lightBlock.length));
    case REPORT.POLLING: return POLLING_RATES[profile.pollingHz] === packet[3];
    case REPORT.BUTTONS:
      if (!profile.buttonSlots) return false;
      return profile.buttonSlots.every((s, i) => sameBytes(asSlot(s), asSlot(packet.slice(3 + i * 3, 6 + i * 3))));
    default: return false;
  }
}
