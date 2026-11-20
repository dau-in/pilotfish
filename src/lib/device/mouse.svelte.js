// The connected X11, whichever way it is connected. Components read `mouse` and call the actions below; the links
// (hid.js, ble.js) do the talking. Every write rebuilds its packet from a fresh read of the mouse, so bytes the
// app does not edit are always copied from the device as it is now, and only counts once a read shows it landed.
import {
  MACRO_SLOTS, MouseError, confirms, buildButtonPacket, buildDpiPacket, buildLightPacket, buildMacroPacket, buildPollingPacket,
} from '../protocol/index.js';
import { BLE_OPTIONS, BleLink } from './ble.js';
import { HID_FILTERS, HidLink, isX11Hid } from './hid.js';

export const support = {
  hid: typeof navigator !== 'undefined' && 'hid' in navigator,
  bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
};

export const mouse = $state({
  status: 'idle', // idle | connecting | ready | error
  kind: null,     // cable | dongle | bluetooth
  version: null,
  profile: null,
  battery: null,
  readAt: null,
  error: null,
  canChangePolling: true,
  maxMacroSteps: 0,
  asleep: false,  // over the receiver: no heartbeat lately, so nothing is sent until it wakes
  beatAt: 0,      // the last heartbeat, so the screen can pulse with it
  waiting: false, // a change is waiting for the mouse to wake before it is sent
});

let link = null;
let refreshTimer = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Is the mouse there, over the receiver? ---------- */
// Through the receiver the mouse sends its battery heartbeat every ~2 s while it is linked. Asleep or out of range
// it sends nothing and the receiver has nobody to pass requests on to; asking it then, or while the mouse re-links
// on waking, is what left the receiver unable to answer until it was plugged in again (2026-10-28). So over the
// receiver nothing is sent without a recent heartbeat, and after a silence the link gets a second one to settle.
const BEAT_GAP_MS = 6000;
const FIRST_BEAT_WAIT_MS = 8000;
// none: this receiver sends no heartbeat. dozing: see doze() below; quick counts heartbeats in a row at the usual pace.
const beat = { last: 0, streak: 0, needed: 1, watch: null, none: false, dozing: false, quick: 0, dozedAt: 0 };
let refreshWhenAwake = false;
const linked = () => mouse.kind !== 'dongle' || beat.none
  || (!beat.dozing && Date.now() - beat.last < BEAT_GAP_MS && beat.streak >= beat.needed);

// Left still for a while, the mouse keeps sending its heartbeat over the receiver, only further apart (3 in 10 s
// instead of 5), but stops answering requests (2026-11-11). Asking again straight away is the insisting that wedges
// the receiver, so a request it doesn't answer puts the link to sleep until the mouse is clearly back: the heartbeat
// at its usual pace again, something done on the mouse, or the pointer moving on this page.
const AWAKE_GAP_MS = 2600;
const DOZE_MIN_MS = 3000;
function doze() {
  Object.assign(beat, { dozing: true, quick: 0, dozedAt: Date.now() });
  mouse.asleep = true;
  refreshWhenAwake = true;
}
function wake() {
  if (!beat.dozing || Date.now() - beat.dozedAt < DOZE_MIN_MS) return;
  beat.dozing = false;
  mouse.asleep = !linked();
  if (!mouse.asleep && refreshWhenAwake) { refreshWhenAwake = false; scheduleRefresh(); }
}
// A request the mouse left unanswered over the receiver is the mouse dozing, not a fault.
async function ask(fn) {
  try { return await fn(); } catch (err) {
    if (err?.code === 'noAnswer' && mouse.kind === 'dongle' && !beat.none) { doze(); throw new MouseError('asleep'); }
    throw err;
  }
}
if (typeof window !== 'undefined') addEventListener('pointermove', () => { if (beat.dozing) wake(); }, { passive: true });

function onBeat() {
  const now = Date.now(), gap = beat.last ? now - beat.last : Infinity;
  if (beat.last && gap > BEAT_GAP_MS) Object.assign(beat, { streak: 0, needed: 2 });
  Object.assign(beat, { last: now, streak: beat.streak + 1, none: false, quick: gap <= AWAKE_GAP_MS ? beat.quick + 1 : 0 });
  mouse.beatAt = now;
  if (beat.dozing && beat.quick >= 2) wake();
  mouse.asleep = !linked();
  if (!mouse.asleep && refreshWhenAwake) { refreshWhenAwake = false; scheduleRefresh(); }
}

function watchBeats() {
  clearInterval(beat.watch);
  Object.assign(beat, { last: 0, streak: 0, needed: 1, none: false, dozing: false, quick: 0, dozedAt: 0 });
  if (mouse.kind === 'dongle') beat.watch = setInterval(() => { mouse.asleep = !linked(); }, 1000);
}

async function untilLinked(ms) {
  for (const end = Date.now() + ms; !linked(); await sleep(250)) {
    if (Date.now() > end) throw new MouseError('asleep');
  }
}

function reset(status = 'idle', error = null) {
  link = null;
  clearInterval(beat.watch);
  clearTimeout(refreshTimer);
  refreshWhenAwake = false;
  Object.assign(mouse, { status, kind: null, version: null, profile: null, battery: null, readAt: null, error, asleep: false, beatAt: 0 });
}

async function refresh() {
  mouse.profile = await ask(() => link.readProfile());
  mouse.readAt = new Date();
}

// Something changed on the mouse itself (the DPI button, …): bursts become one read, and over the receiver it
// waits until the mouse is linked again.
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (!linked()) { refreshWhenAwake = true; return; }
    refresh().catch(() => {});
  }, 400);
}

function onNotice(notice) {
  if (notice.battery) { mouse.battery = notice.battery; onBeat(); return; }
  // Something done on the mouse: it is awake.
  if (beat.dozing) { beat.dozedAt = 0; wake(); }
  scheduleRefresh();
}

async function attach(newLink) {
  if (link) await link.close().catch(() => {});
  link = newLink;
  Object.assign(mouse, {
    status: 'connecting', kind: link.kind, error: null,
    canChangePolling: link.canChangePolling, maxMacroSteps: link.maxMacroSteps,
  });
  watchBeats();
  try {
    await link.open(onNotice, () => { if (link === newLink) reset(); });
    // A mouse asleep at connect time is left alone until it wakes. If no heartbeat ever comes, it is asked once.
    if (mouse.kind === 'dongle') {
      mouse.asleep = true;
      await untilLinked(FIRST_BEAT_WAIT_MS).catch(() => {});
      if (link !== newLink) return;
      if (!beat.last) { beat.none = true; mouse.asleep = false; }
    }
    // Dozing at connect time: wait for it to come back, then ask once more.
    const readAll = async () => { mouse.version = await ask(() => link.readVersion()); await refresh(); };
    await readAll().catch(async err => {
      if (err?.code !== 'asleep') throw err;
      await untilLinked(60000);
      if (link === newLink) await readAll();
    });
    if (link !== newLink) return;
    mouse.status = 'ready';
  } catch (err) {
    await link?.close().catch(() => {});
    reset('error', err); // kept whole: the screen words it in the user's language
  }
}

/* ---------- Finding the mouse ---------- */

// Cable and receiver: Chrome remembers the permission, so after the first time the app connects on its own.
// Bluetooth does the same only where Chrome exposes getDevices() (still behind a flag in most versions);
// otherwise the mouse has to be put in pairing mode and picked again.
export async function autoConnect() {
  const demo = import.meta.env.DEV && new URLSearchParams(location.search).get('demo');
  if (typeof demo === 'string') {
    const { DemoLink } = await import('./demo.js');
    await attach(new DemoLink(demo));
    return;
  }
  if (support.hid) {
    const known = (await navigator.hid.getDevices()).filter(isX11Hid);
    const pick = known.find(d => d.productId === 0xfa55) ?? known[0]; // the cable first when both are there
    if (pick) { await attach(new HidLink(pick)); if (mouse.status === 'ready') return; }
  }
  if (support.bluetooth && navigator.bluetooth.getDevices) {
    const known = (await navigator.bluetooth.getDevices()).filter(d => /^X11/i.test(d.name ?? ''));
    for (const device of known) {
      await attach(new BleLink(device));
      if (mouse.status === 'ready') return;
    }
    if (known.length) reset(); // remembered but not reachable now: back to the welcome screen, without an error
  }
}

export async function connectUsb() {
  const [device] = await navigator.hid.requestDevice({ filters: HID_FILTERS });
  if (device) await attach(new HidLink(device));
}

// Bluetooth: Chrome only lists devices that advertise, so the mouse must be in pairing mode the first time.
export async function connectBluetooth() {
  const device = await navigator.bluetooth.requestDevice(BLE_OPTIONS);
  await attach(new BleLink(device));
}

export async function disconnect() {
  if (link) await link.close().catch(() => {});
  reset();
}

if (support.hid) {
  navigator.hid.addEventListener('connect', e => { if (!link && isX11Hid(e.device)) attach(new HidLink(e.device)); });
  navigator.hid.addEventListener('disconnect', e => { if (link?.device === e.device) reset(); });
}

/* ---------- Changing it ---------- */

// Over the receiver a write can be lost without any error, and insisting quickly is what leaves the mouse unable
// to take more until it is plugged in again. So: look at it a few times, unhurried, resend once at most, and give up.
const CONFIRM_LOOKS = 3;
const CONFIRM_GAP_MS = 800;
async function write(build) {
  if (!link || mouse.status !== 'ready') throw new MouseError('notConnected');
  // Asleep, the change waits for the mouse to come back, for a minute at most; the screen says so meanwhile.
  if (!linked()) {
    mouse.waiting = true;
    try { await untilLinked(60000); } finally { mouse.waiting = false; }
  }
  const packet = build(await ask(() => link.readProfile()));
  for (let send = 0; send < 2; send++) {
    await link.write(packet);
    for (let look = 0; look < CONFIRM_LOOKS; look++) {
      if (look) await sleep(CONFIRM_GAP_MS);
      const profile = await ask(() => link.readProfile());
      if (confirms(profile, packet)) {
        mouse.profile = profile;
        mouse.readAt = new Date();
        return;
      }
    }
  }
  await refresh().catch(() => {});
  throw new MouseError('notConfirmed');
}

export const applyDpi = changes => write(p => buildDpiPacket(p, changes));
export const applyLight = changes => write(p => buildLightPacket(p, changes));
export const applyButtons = assign => write(p => buildButtonPacket(p, assign));
export async function applyPolling(hz) {
  if (!mouse.canChangePolling) throw new MouseError('pollingBluetooth');
  await write(() => buildPollingPacket(hz));
}

export async function readMacro(button) {
  await untilLinked(10000);
  return ask(() => link.readMacro(MACRO_SLOTS[button]));
}

// Saves a button's macro (verified by reading it back) and assigns it to that button.
export async function saveMacro(button, { mode, loops, events }) {
  await untilLinked(10000);
  const id = MACRO_SLOTS[button];
  const packet = buildMacroPacket(id, { mode, loops, events });
  // Byte 28 counts slots (a long pause takes two); kept short enough to be read back whole.
  if (packet[28] > mouse.maxMacroSteps) throw new MouseError('macroSteps', { max: mouse.maxMacroSteps });
  await ask(() => link.writeMacro(packet));
  await applyButtons({ [button]: [18, 0, id] });
}
