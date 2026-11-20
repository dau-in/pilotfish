// Which HID interface the app opens. The receiver's interfaces as Chrome described them on another owner's Windows 11
// (2026-11-20): it handed back the media keys first, and writing to them failed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isX11Hid, pickConfigInterface } from '../src/lib/device/hid.js';

const iface = (...pages) => ({ vendorId: 0x1d57, productId: 0xfa60, productName: '2.4G Wireless Device', collections: pages.map(usagePage => ({ usagePage, usage: 1 })) });
const MEDIA = iface(0x0c);
const CONFIG = iface(0x0a, 0x0b);

test('opens the configuration interface, whatever order the chooser returns', () => {
  assert.equal(pickConfigInterface([MEDIA, CONFIG]), CONFIG);
  assert.equal(pickConfigInterface([CONFIG, MEDIA]), CONFIG);
  assert.equal(pickConfigInterface([MEDIA]), null);
  assert.equal(isX11Hid(MEDIA), false);
});
