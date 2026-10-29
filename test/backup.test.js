// Backups: what they keep, how two are compared, how one becomes a draft again, and what a file may bring in.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildButtonPacket, buildDpiPacket, buildLightPacket, parseButtonReport, parseProfile } from '../src/lib/protocol/index.js';
import { differences, draftFrom, fromFile, sameSettings, settingsOf, toFile } from '../src/lib/backup/format.js';

const bytes = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));
// The same captures as protocol.test.js: the profile at 800 DPI and the factory buttons.
const PROFILE_800 = bytes(`0a 80 01 01 fe 00 01 3f 20 20 12 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01
  ff 00 00 00 ff 00 00 00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 00 69 0f 00 03 a8 00 ff 00 01 04 af`);
const BUTTON_REPORT = bytes(`08 3b 01 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 06 00 00 05 00 00 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 00 3e 00 ff 01 04 bf`);

const profile = () => ({ ...parseProfile(PROFILE_800), ...parseButtonReport(BUTTON_REPORT) });

test('a backup keeps every area the editor writes', () => {
  const s = settingsOf(profile());
  assert.deepEqual(Object.keys(s), ['dpi', 'polling', 'power', 'light', 'buttons']);
  assert.deepEqual(s.dpi.levels.map(l => l.dpi), [800, 1600, 2400, 3200, 5000, 22000]);
  assert.equal(s.polling, 1000);
  assert.deepEqual(s.power, { sleepMinutes: 10, keyResponseMs: 8 });
  assert.deepEqual(s.buttons.back, [5, 0, 0]);
});

test('pressing the DPI button is not a different setup', () => {
  const a = settingsOf(profile());
  const b = settingsOf({ ...profile(), activeLevel: 3 });
  assert.ok(sameSettings(a, b));
});

test('differences name the areas that changed', () => {
  const p = profile();
  const a = settingsOf(p);
  const edited = { ...p, ripple: false, lighting: { ...p.lighting, color: '#123456' } };
  assert.deepEqual(differences(a, settingsOf(edited)), ['dpi', 'light']);
  // Buttons unread over Bluetooth do not count as a difference.
  assert.deepEqual(differences(a, settingsOf({ ...p, buttons: null })), []);
});

test('a restored draft writes the backup and keeps the bytes it does not hold', () => {
  const p = profile();
  const backup = settingsOf({
    ...p, angleSnap: true, levels: p.levels.map((l, i) => (i === 0 ? { ...l, dpi: 900 } : l)),
    buttons: p.buttons.map(b => (b.id === 'back' ? { ...b, raw: [4, 0, 0] } : b)),
  });
  const d = draftFrom(p, backup);
  assert.deepEqual(settingsOf(d), backup);
  assert.deepEqual(d.dpiBlock, p.dpiBlock);
  assert.equal(d.levels[0].enabled, p.levels[0].enabled);
  // The protocol builders take it like any edit.
  buildDpiPacket(p, { levels: d.levels, angleSnap: d.angleSnap });
  buildButtonPacket(p, Object.fromEntries(d.buttons.map(b => [b.id, b.raw])));
  buildLightPacket(p, { ...d.lighting, sleepMinutes: d.sleepMinutes, keyResponseMs: d.keyResponseMs });
  // Polling stays when the link cannot write it.
  assert.equal(draftFrom(p, { ...backup, polling: 500 }, { polling: false }).pollingHz, 1000);
});

test('a backup file round-trips and rejects what is not one', () => {
  const backup = { id: 7, at: Date.UTC(2026, 9, 28), reason: 'saved', kept: false, first: false, firmware: '1.12', settings: settingsOf(profile()) };
  const file = JSON.parse(JSON.stringify(toFile([backup])));
  assert.equal(file.backups[0].id, undefined);
  assert.deepEqual(fromFile(file), [{ at: backup.at, reason: 'saved', kept: false, first: false, firmware: '1.12', settings: backup.settings }]);

  assert.equal(fromFile({ hello: 1 }), null);
  assert.equal(fromFile({ ...file, version: 99 }), null);
  const bad = structuredClone(file);
  bad.backups[0].settings.buttons.left = [2, 0, 999];
  bad.backups.push({ ...file.backups[0], settings: { ...file.backups[0].settings, light: { mode: 'x' } } });
  assert.deepEqual(fromFile(bad), []);
});
