// The X11 over Web Bluetooth. In Bluetooth mode it shows up as "X11mouse1"/"X11mouse2" and is configured through
// its own GATT service FEE0: the same packets as over USB written to FEE3, answers and notices on FEE4.
// Never touch the F000FFC0… service: it is TI's over-the-air firmware update.
import {
  BLE, BLE_READ, MouseError, bleProfileToReport, bleRequest, parseBleNotice, parseBleVersion, parseProfile,
} from '../protocol/index.js';

const ANSWER_TIMEOUT_MS = 3000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const BLE_OPTIONS = { filters: [{ namePrefix: 'X11' }], optionalServices: [BLE.SERVICE] };

export class BleLink {
  #device;
  #server = null;
  #tx = null;
  #queue = Promise.resolve();
  #waiters = new Set(); // { match(bytes) → value | undefined, resolve }
  #onNotice = () => {};

  constructor(device) {
    this.#device = device;
    this.kind = 'bluetooth';
    this.canChangePolling = false; // the official app does not offer it over Bluetooth either
    this.maxMacroSteps = 0;        // macro transfer over Bluetooth has not been captured yet
  }

  get device() { return this.#device; }

  async open(onNotice, onGone) {
    this.#onNotice = onNotice ?? (() => {});
    this.#device.addEventListener('gattserverdisconnected', () => onGone?.(), { once: true });
    this.#server = await this.#device.gatt.connect();
    const service = await this.#server.getPrimaryService(BLE.SERVICE);
    this.#tx = await service.getCharacteristic(BLE.WRITE);
    const rx = await service.getCharacteristic(BLE.NOTIFY);
    rx.addEventListener('characteristicvaluechanged', e => this.#receive(new Uint8Array(e.target.value.buffer)));
    await rx.startNotifications();
  }

  async close() {
    if (this.#device.gatt.connected) this.#device.gatt.disconnect();
  }

  #receive(bytes) {
    for (const w of this.#waiters) {
      const value = w.match(bytes);
      if (value !== undefined) { this.#waiters.delete(w); w.resolve(value); return; }
    }
    const notice = parseBleNotice(bytes);
    if (notice && !notice.ack) this.#onNotice(notice);
  }

  // Writes a packet and waits for the first message on FEE4 that `match` accepts.
  async #exchange(packet, match, what) {
    let waiter;
    const answer = new Promise((resolve, reject) => {
      waiter = { match, resolve };
      this.#waiters.add(waiter);
      setTimeout(() => { this.#waiters.delete(waiter); reject(new MouseError('noAnswer', { what })); }, ANSWER_TIMEOUT_MS);
    });
    await this.#tx.writeValueWithResponse(Uint8Array.from(packet));
    return answer;
  }

  #run(fn) {
    const next = this.#queue.then(fn);
    this.#queue = next.catch(() => {});
    return next;
  }

  async #read(cmd, what, attempts = 2) {
    for (let a = 1; ; a++) {
      try { return await this.#exchange(bleRequest(cmd), b => (b[0] === cmd ? b : undefined), what); } catch (err) {
        if (a >= attempts) throw err;
        await sleep(200);
      }
    }
  }

  readVersion() {
    return this.#run(async () => parseBleVersion(await this.#read(BLE_READ.VERSION, 'version')));
  }

  // Over Bluetooth the whole profile, buttons included, comes in one message.
  readProfile() {
    return this.#run(async () => parseProfile(bleProfileToReport(await this.#read(BLE_READ.PROFILE, 'profile'))));
  }

  readMacro() { return Promise.reject(new MouseError('macrosNeedUsb')); }
  writeMacro() { return Promise.reject(new MouseError('macrosNeedUsb')); }

  // Every write is confirmed with 55 50 00 <report>; a non-zero status means the mouse refused it.
  write(packet) {
    return this.#run(async () => {
      const ack = await this.#exchange(packet, b => {
        const n = parseBleNotice(b);
        return n?.ack?.report === packet[0] ? n.ack : undefined;
      }, 'confirmation');
      if (!ack.ok) throw new MouseError('rejected');
    });
  }
}
