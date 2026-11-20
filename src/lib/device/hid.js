// The X11 over WebHID: the cable (1D57:FA55) and the 2.4 GHz receiver (1D57:FA60). Same feature reports as the
// official app, on the configuration collection (usage page 0x0B). See docs/protocol.md for every byte.
import {
  MACRO_WEB_MAX_EVENTS, MouseError, REPORT, REQUEST_BUTTONS, REQUEST_PROFILE, REQUEST_VERSION, STATUS_READY,
  macroChunks, parseButtonReport, parseMacroHead, parseNotify, parseProfile, parseVersion, requestMacroHead,
} from '../protocol/index.js';

const VENDOR_ID = 0x1d57;
const KINDS = { 0xfa55: 'cable', 0xfa60: 'dongle' };
const CONFIG_PAGE = 0x0b;
// After a write the channel stays quiet while the change reaches the mouse: instant on the cable, over the air
// through the receiver (a request sent meanwhile drops the write without an error).
const SETTLE_MS = { cable: 80, dongle: 2000 };
const MACRO_CHUNK_GAP_MS = 500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const HID_FILTERS = Object.keys(KINDS).map(pid => ({ vendorId: VENDOR_ID, productId: +pid, usagePage: CONFIG_PAGE }));
export const isX11Hid = d => d.vendorId === VENDOR_ID && d.productId in KINDS
  && d.collections.some(c => c.usagePage === CONFIG_PAGE);

export class HidLink {
  #device;
  #queue = Promise.resolve();
  #onNotice = () => {};

  constructor(device) {
    this.#device = device;
    this.kind = KINDS[device.productId];
    this.canChangePolling = true;
    this.maxMacroSteps = MACRO_WEB_MAX_EVENTS;
  }

  get device() { return this.#device; }

  async open(onNotice) {
    this.#onNotice = onNotice ?? (() => {});
    if (!this.#device.opened) await this.#device.open();
    // Report 3 (the notify collection): the battery heartbeat over the receiver, or something changed on the mouse.
    this.#device.oninputreport = e => {
      if (e.reportId !== 3) return;
      const data = [3, ...new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength)];
      this.#onNotice(parseNotify(data) ?? { changed: true });
    };
  }

  async close() {
    this.#device.oninputreport = null;
    if (this.#device.opened) await this.#device.close();
  }

  // One request at a time: the firmware answers one exchange before the next.
  #run(fn) {
    const next = this.#queue.then(fn);
    this.#queue = next.catch(() => {});
    return next;
  }

  async #send(packet, attempts = 4) {
    for (let i = 1; ; i++) {
      try { return await this.#device.sendFeatureReport(packet[0], Uint8Array.from(packet.slice(1))); } catch (err) {
        if (i >= attempts) throw err;
        await sleep(120);
      }
    }
  }

  // WebHID hands back the report with or without its id depending on the platform; always return it with.
  async #get(id) {
    const v = await this.#device.receiveFeatureReport(id);
    const b = Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    return b[0] === id ? b : [id, ...b];
  }

  // Request on 0xA0, wait until the status report says ready, fetch the answer. The first request after a while
  // idle is sometimes ignored, so the whole exchange is retried.
  async #request(req, id, attempts = 3) {
    for (let a = 1; ; a++) {
      try {
        await this.#send(req);
        let ready = false;
        for (let i = 0; i < 15 && !ready; i++) {
          await sleep(60);
          ready = (await this.#get(REPORT.STATUS))[1] === STATUS_READY;
        }
        if (!ready) throw new MouseError('noAnswer');
        const answer = await this.#get(id);
        if (answer[0] !== id) throw new MouseError('wrongAnswer');
        return answer;
      } catch (err) {
        if (a >= attempts) throw err;
        await sleep(150 * a);
      }
    }
  }

  readVersion() {
    return this.#run(async () => parseVersion(await this.#request(REQUEST_VERSION, REPORT.VERSION)));
  }

  // WebHID returns at most 64 bytes, so the profile comes without its button half: read the buttons apart.
  readProfile() {
    return this.#run(async () => {
      const profile = parseProfile(await this.#request(REQUEST_PROFILE, REPORT.PROFILE));
      return { ...profile, ...parseButtonReport(await this.#request(REQUEST_BUTTONS, REPORT.BUTTONS)) };
    });
  }

  readMacro(id) {
    return this.#run(async () => parseMacroHead(await this.#request(requestMacroHead(id), 0x09)));
  }

  write(packet) {
    return this.#run(async () => { await this.#send(packet); await sleep(SETTLE_MS[this.kind]); });
  }

  // Macros go out in 64-byte pieces half a second apart, then are read back: the head must match what was sent.
  writeMacro(packet) {
    return this.#run(async () => {
      for (const chunk of macroChunks(packet)) {
        await this.#send(chunk);
        await sleep(Math.max(MACRO_CHUNK_GAP_MS, SETTLE_MS[this.kind]));
      }
      const back = await this.#request(requestMacroHead(packet[2]), 0x09);
      const end = Math.min(64, 29 + 2 * packet[28]);
      for (let i = 2; i < end; i++) if (back[i] !== packet[i]) throw new MouseError('macroNotSaved');
    });
  }
}
