// Checks the protocol module against real bytes captured from the official app (probe/trace2.log).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bleProfileToReport, buildButtonPacket, buildDpiPacket, buildLightPacket, buildMacroPacket, macroChunks, MACRO_SLOTS,
  confirms, parseBleNotice, parseButtonReport, parseMacroHead, buildPollingPacket, buildPowerPacket, decodeDpi, describeFunction, encodeDpi, parseMacro, parseNotify, parseProfile, parseVersion, snapDpi,
} from '../src/lib/protocol/index.js';

const bytes = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));

// Profile read at startup (level 1 = 800 DPI), first 64 bytes.
const PROFILE_800 = bytes(`0a 80 01 01 fe 00 01 3f 20 20 12 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01
  ff 00 00 00 ff 00 00 00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 00 69 0f 00 03 a8 00 ff 00 01 04 af`);

// What the official app sent after setting level 1 to 900, then with angle snap on.
const DPI_900 = bytes(`04 38 01 00 01 3f 20 20 15 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01 ff 00 00
  00 ff 00 00 00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 0f 6c 00 00 00 00`);
const DPI_900_SNAP = bytes(`04 38 01 01 01 3f 20 20 15 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01 ff 00
  00 00 ff 00 00 00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 0f 6d 00 00 00 00`);

test('parses the captured profile', () => {
  const p = parseProfile(PROFILE_800);
  assert.equal(p.pollingHz, 1000);
  assert.deepEqual(p.levels.map(l => l.dpi), [800, 1600, 2400, 3200, 5000, 22000]);
  assert.deepEqual(p.levels.map(l => l.color), ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']);
  assert.equal(p.activeLevel, 1);
  assert.equal(p.angleSnap, false);
  assert.equal(p.ripple, true);
  assert.equal(p.sleepMinutes, 10);
  assert.equal(p.keyResponseMs, 8);
});

test('DPI write matches the official app byte for byte', () => {
  const p = parseProfile(PROFILE_800);
  const levels = p.levels.map((l, i) => (i === 0 ? { ...l, dpi: 900 } : l));
  assert.deepEqual(buildDpiPacket(p, { levels }), DPI_900);
  assert.deepEqual(buildDpiPacket(p, { levels, angleSnap: true }), DPI_900_SNAP);
});

test('polling writes match the official app', () => {
  assert.deepEqual(buildPollingPacket(500), bytes('06 09 01 02 fd 00 00 00 00'));
  assert.deepEqual(buildPollingPacket(1000), bytes('06 09 01 01 fe 00 00 00 00'));
  assert.throws(() => buildPollingPacket(2000));
});

test('DPI encoding round-trips across the whole range', () => {
  for (let dpi = 50; dpi <= 22000; dpi += 50) {
    const s = snapDpi(dpi);
    const e = encodeDpi(s);
    assert.equal(decodeDpi(e.x, e.y, e.doubled ? 1 : 0), s, `dpi ${dpi}`);
  }
});

// The full 128-byte profile, read with getFeatureReport(0x0a, 128) on 2026-10-27.
const PROFILE_FULL = bytes(`0a 80 01 01 fe 00 01 3f 20 20 12 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01 ff 00
  00 00 ff 00 00 00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 00 69 0f 00 03 a8
  00 ff 00 01 04 af 01 02 00 00 03 00 00 04 00 00 00 00 00 00 00 00 0d 00 00 06 00 00 05
  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 09 00 00
  0a 00 00 34 00 00 00 00 00 00 00 00`);

test('reads the factory button mapping from the full profile', () => {
  const p = parseProfile(PROFILE_FULL);
  assert.equal(PROFILE_FULL.length, 128);
  assert.deepEqual(p.buttons.map(b => [b.id, b.action]), [
    ['left', 'Left click'], ['right', 'Right click'], ['wheel', 'Middle click'], ['forward', 'Forward'],
    ['back', 'Back'], ['dpi', 'DPI cycle'], ['wheel-up', 'Scroll up'], ['wheel-down', 'Scroll down'],
  ]);
  assert.ok(p.buttons.every(b => b.factory));
  assert.equal(parseProfile(PROFILE_800).buttons, null); // a 64-byte read has no buttons
  const torn = PROFILE_FULL.slice(); torn[65] = 3; // checksum no longer matches
  assert.equal(parseProfile(torn).buttons, null);
});

test('describes key combinations like the official presets', () => {
  assert.equal(describeFunction([17, 1, 6]), 'Ctrl + C');
  assert.equal(describeFunction([17, 4, 43]), 'Alt + Tab');
  assert.equal(describeFunction([17, 10, 22]), 'Shift + Win + S');
  assert.equal(describeFunction([17, 8, 7]), 'Win + D');
});

// Writes the official app sent on 2026-10-27 (probe/trace3.log), starting from the factory mapping.
const BTN_BACK_TO_MIDDLE = bytes(`08 3b 01 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 06 00 00 04 00 00 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 00 3d`);
const BTN_FACTORY = bytes(`08 3b 01 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 06 00 00 05 00 00 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 00 3e`);
const BTN_FORWARD_TO_CTRL_C = bytes(`08 3b 01 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 11 01 06 05 00 00 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 00 50`);

test('button writes match the official app byte for byte', () => {
  const p = parseProfile(PROFILE_FULL);
  assert.deepEqual(buildButtonPacket(p, { back: [4, 0, 0] }), BTN_BACK_TO_MIDDLE);
  assert.deepEqual(buildButtonPacket(p), BTN_FACTORY);
  assert.deepEqual(buildButtonPacket(p, { forward: [17, 1, 6] }), BTN_FORWARD_TO_CTRL_C);
});

test('button writes refuse to leave the mouse without a left click', () => {
  const p = parseProfile(PROFILE_FULL);
  assert.throws(() => buildButtonPacket(p, { left: [3, 0, 0] }), /leftClickRequired/);
  assert.deepEqual(buildButtonPacket(p, { left: [3, 0, 0], right: [2, 0, 0] }).slice(3, 9), [3, 0, 0, 2, 0, 0]);
  assert.throws(() => buildButtonPacket(p, { back: [99, 0, 0] }), /unknownFunction/);
  assert.throws(() => buildButtonPacket(parseProfile(PROFILE_800)), /buttonsUnread/);
});

test('power writes match the official app byte for byte', () => {
  const p = parseProfile(PROFILE_FULL);
  assert.deepEqual(buildPowerPacket(p, { sleepMinutes: 15 }), bytes('05 0f 01 00 03 f8 00 ff 00 01 04 01 ff 00 00'));
  assert.deepEqual(buildPowerPacket(p), bytes('05 0f 01 00 03 a8 00 ff 00 01 04 01 af 00 00'));
  assert.deepEqual(buildPowerPacket(p, { keyResponseMs: 16 }), bytes('05 0f 01 00 03 a8 00 ff 00 01 08 01 b3 00 00'));
  // Above 15 minutes the high nibble moves into the speed byte.
  assert.deepEqual(buildPowerPacket(p, { sleepMinutes: 30 }).slice(4, 6), [0x13, 0xe8]);
  assert.throws(() => buildPowerPacket(p, { sleepMinutes: 0 }));
  // One minute, written through the receiver, made the X11 drop the link and blink red until the receiver was
  // plugged in again (2026-11-19); 2 and 11 went through. The official slider offers it, Pilotfish doesn't.
  assert.throws(() => buildPowerPacket(p, { sleepMinutes: 1 }), /sleepRange/);
  assert.equal(buildPowerPacket(p, { sleepMinutes: 2 })[5], 0x28);
  assert.throws(() => buildPowerPacket(p, { keyResponseMs: 7 }));
});

test('light writes match the official app byte for byte', () => {
  // probe/trace4.log, 2026-10-28: modes in turn, then Static in magenta at brightness 2 and 1, then back to off.
  const p = parseProfile(PROFILE_FULL);
  assert.deepEqual(p.lighting, { mode: 0, color: '#00ff00', brightness: 8, speed: 3 });
  assert.deepEqual(buildLightPacket(p, { mode: 1 }), bytes('05 0f 01 10 03 a8 00 ff 00 01 04 01 bf 00 00'));
  assert.deepEqual(buildLightPacket(p, { mode: 2 }), bytes('05 0f 01 20 03 a8 00 ff 00 01 04 01 cf 00 00'));
  assert.deepEqual(buildLightPacket(p, { mode: 3 }), bytes('05 0f 01 30 03 a8 00 ff 00 01 04 01 df 00 00'));
  assert.deepEqual(buildLightPacket(p, { mode: 4 }), bytes('05 0f 01 40 03 a8 00 ff 00 01 04 01 ef 00 00'));
  assert.deepEqual(buildLightPacket(p, { mode: 1, color: '#ff00ff' }), bytes('05 0f 01 10 03 a8 ff 00 ff 01 04 02 be 00 00'));
  assert.deepEqual(buildLightPacket(p, { mode: 1, color: '#ff00ff', brightness: 2 }), bytes('05 0f 01 10 03 a2 ff 00 ff 01 04 02 b8 00 00'));
  assert.deepEqual(buildLightPacket(p, { mode: 1, color: '#ff00ff', brightness: 1 }), bytes('05 0f 01 10 03 a1 ff 00 ff 01 04 02 b7 00 00'));
  assert.deepEqual(buildLightPacket(p, { mode: 0, color: '#ff00ff' }), bytes('05 0f 01 00 03 a8 ff 00 ff 01 04 02 ae 00 00'));
  // Light and power share the report: changing one keeps the other.
  assert.deepEqual(buildLightPacket(p, { mode: 1, sleepMinutes: 15 }).slice(3, 6), [0x10, 0x03, 0xf8]);
  assert.throws(() => buildLightPacket(p, { mode: 7 }));
  assert.throws(() => buildLightPacket(p, { brightness: 9 }));
});

test('reads the battery heartbeat sent over the dongle', () => {
  // Captured every 2 s with the X11 on its 2.4 GHz dongle on 2026-10-28.
  assert.deepEqual(parseNotify(bytes('03 55 40 01 64')), { deviceNo: 0x55, battery: { state: 'battery', level: 100 } });
  assert.deepEqual(parseNotify(bytes('03 55 40 01 0f')).battery, { state: 'battery', level: 15 });
  assert.deepEqual(parseNotify(bytes('03 55 40 03 32')).battery, { state: 'charging', level: 50 });
  assert.deepEqual(parseNotify(bytes('03 55 40 02 00')).battery, { state: 'full', level: 100 });
  // Captured with the X11 resting on its charging dock, battery full (2026-10-28).
  assert.deepEqual(parseNotify(bytes('03 55 40 02 64')).battery, { state: 'full', level: 100 });
  assert.equal(parseNotify(bytes('03 55 10 02 00')), null); // not a status frame: something changed, re-read
});

// The official app recording "ab" and assigning it to the rear side button (probe/trace5.log, 2026-10-28).
// Trailing zeros dropped: every piece goes out padded to the 64-byte feature report.
const MACRO_AB_CHUNKS = [
  bytes('09 40 08 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 04 01 04 81 04 01 05 81 05'),
  bytes('09 40 08 01'),
  bytes('09 0c 08 02 00 00 00 00 00 00 01 1b'),
];
const BTN_BACK_TO_MACRO_8 = bytes(`08 3b 01 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 06 00 00 12 00 08 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 00 53`);
const pad64 = a => [...a, ...new Array(64 - a.length).fill(0)];

test('macros go out in the same pieces as the official app', () => {
  const events = [
    { usage: 4, down: true, delay: 0 }, { usage: 4, down: false, delay: 0 },
    { usage: 5, down: true, delay: 0 }, { usage: 5, down: false, delay: 0 },
  ];
  assert.equal(MACRO_SLOTS.back, 8);
  const packet = buildMacroPacket(MACRO_SLOTS.back, { mode: 'times', loops: 1, events });
  assert.deepEqual(macroChunks(packet).map(pad64), MACRO_AB_CHUNKS.map(pad64));
  assert.deepEqual(parseMacro(packet), { id: 8, empty: false, mode: 'times', loops: 1, events });
  assert.deepEqual(buildButtonPacket(parseProfile(PROFILE_FULL), { back: [18, 0, 8] }), BTN_BACK_TO_MACRO_8);
});

test('macro delays, long delays and limits', () => {
  const events = [
    { usage: 4, down: true, delay: 60 }, { usage: 4, down: false, delay: 40 },
    { usage: 5, down: true, delay: 1500 }, { usage: 5, down: false, delay: 0 },
  ];
  const p = buildMacroPacket(8, { mode: 'whileHeld', events });
  assert.deepEqual(p.slice(0, 8), [0x09, 0x83, 8, 2, 0, 0, 0, 1]);
  assert.equal(p[28], 5); // four events plus one for the long delay
  assert.deepEqual(p.slice(29, 41), [7, 4, 4 | 129, 4, 10 | 1, 5, 7, 3, 129, 5, 0, 0]);
  assert.deepEqual(parseMacro(p).events, events);
  assert.equal(parseMacro(buildMacroPacket(8, { events: [{ usage: 4, down: true, delay: 50 }] })).events[0].delay, 60); // 20 ms steps
  assert.deepEqual(parseMacro([0x09, 0x83, 8, ...new Array(128).fill(0xff)]), { id: 8, empty: true, events: [] });
  assert.throws(() => buildMacroPacket(5, { events })); // no button has slot 4, so there is no macro 5
  assert.throws(() => buildMacroPacket(8, { events: [] }));
});

// 64-byte reads, as WebHID returns them (probed over the receiver on 2026-10-28).
const BUTTON_REPORT = bytes(`08 3b 01 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 06 00 00 05 00 00 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 00 3e 00 ff 01 04 bf`);
// "hola" recorded in Pilotfish and stored in the rear button's slot (8), first 64 bytes.
const MACRO_HOLA_HEAD = bytes(`09 40 08 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 08 0b
  0b a1 0b 0b 12 ab 12 09 0f b1 0f 0f 04 81 04 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00`);
// The profile as it arrived over Bluetooth (probe/trace6.log): a0 + the USB profile from byte 3.
const BLE_PROFILE = bytes(`a0 01 fe 00 01 3f 20 20 12 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01 ff 00 00 00 ff
  00 00 00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 00 69 0f 10 03 a8 ff ff 00 01
  04 be 02 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 06 00 00 05 00 00 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 3e`);

test('reads buttons on their own, in 64 bytes', () => {
  const { buttons, buttonSlots } = parseButtonReport(BUTTON_REPORT);
  assert.equal(buttonSlots.length, 18);
  assert.ok(buttons.every(b => b.factory));
  const torn = BUTTON_REPORT.slice(); torn[3] = 3;
  assert.equal(parseButtonReport(torn).buttons, null);
});

test('reads the head of a macro in 64 bytes', () => {
  const m = parseMacroHead(MACRO_HOLA_HEAD);
  assert.equal(m.id, 8);
  assert.equal(m.truncated, false);
  assert.deepEqual(m.events.map(e => `${e.usage}${e.down ? 'v' : '^'}`), ['11v', '11^', '18v', '18^', '15v', '15^', '4v', '4^']);
  assert.equal(parseMacroHead([0x09, 0x40, 8, ...new Array(61).fill(0xff)]).empty, true);
});

test('Bluetooth profile, notices and confirmations', () => {
  const report = bleProfileToReport(BLE_PROFILE);
  const p = parseProfile(report);
  assert.deepEqual(p.levels.map(l => l.dpi), [800, 1600, 2400, 3200, 5000, 22000]);
  assert.equal(p.pollingHz, 1000);
  assert.ok(p.buttons, 'the button sum checks out after rebuilding its high byte');
  assert.deepEqual(parseBleNotice(bytes('55 40 01 63')).battery, { state: 'battery', level: 99 });
  assert.deepEqual(parseBleNotice(bytes('55 50 00 05')), { ack: { report: 5, ok: true } });
  assert.equal(parseBleNotice(bytes('a1 01 12')), null);
});

test('a fresh read confirms a write only when the mouse holds exactly what was sent', () => {
  const p = parseProfile(PROFILE_FULL);
  // Nothing changed yet: each packet that writes back what the mouse holds is confirmed, a different one is not.
  assert.ok(confirms(p, buildDpiPacket(p)));
  assert.ok(!confirms(p, buildDpiPacket(p, { levels: p.levels.map((l, i) => (i ? l : { ...l, color: '#ffff00' })) })));
  assert.ok(confirms(p, buildLightPacket(p)));
  assert.ok(!confirms(p, buildLightPacket(p, { mode: 1 })));
  assert.ok(confirms(p, buildPollingPacket(1000)));
  assert.ok(!confirms(p, buildPollingPacket(500)));
  // The mouse reads empty button slots back as 00 while the write sends them as 01 00 00.
  assert.ok(confirms(p, buildButtonPacket(p)));
  assert.ok(!confirms(p, buildButtonPacket(p, { back: [4, 0, 0] })));
  // After the write lands, the read that follows it confirms it.
  const written = buildLightPacket(p, { mode: 1, color: '#ff00ff' });
  const after = PROFILE_FULL.slice();
  written.slice(3, 11).forEach((v, i) => (after[55 + i] = v));
  assert.ok(confirms(parseProfile(after), written));
});

test('firmware version', () => {
  assert.equal(parseVersion(bytes('0b 08 01 12 00 00 00 00')), '1.12');
});
