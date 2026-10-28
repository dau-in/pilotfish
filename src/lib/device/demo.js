// Development only (`?demo` on the dev server): a pretend X11 that answers with a profile read from a real one, so
// the screens can be worked on, inspected and screenshotted without the mouse. Writes land in its copy of the bytes.
// It never ships: mouse.svelte.js only loads it when import.meta.env.DEV is true.
import { REPORT, parseButtonReport, parseProfile } from '../protocol/index.js';

// Read from the author's X11 over the receiver on 2026-10-28 (first 64 bytes of the profile, then the buttons).
const PROFILE = `0a 80 01 01 fe 00 01 3f 20 20 12 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01 ff 00 00 00 ff 00 00 00 ff
  ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 00 69 0f 10 03 a8 00 00 ff 01 04 01 bf`;
const BUTTONS = `08 3b 01 02 00 00 03 00 00 04 00 00 01 00 00 01 00 00 0d 00 00 06 00 00 05 00 00 01 00 00 01 00 00 01 00 00
  01 00 00 01 00 00 01 00 00 01 00 00 01 00 00 09 00 00 0a 00 00 00 3e`;
const bytes = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class DemoLink {
  kind = 'dongle';
  canChangePolling = true;
  maxMacroSteps = 17;
  device = null;
  #beats = null;
  // The heartbeat a real one sends through the receiver every ~2 s.
  async open(onNotice) {
    const beat = () => onNotice({ battery: { state: 'battery', level: 86 } });
    setTimeout(beat, 300);
    this.#beats = setInterval(beat, 2000);
  }
  async close() { clearInterval(this.#beats); }
  async readVersion() { await sleep(150); return '1.12'; }
  #profile = bytes(PROFILE);
  #buttons = bytes(BUTTONS);
  async readProfile() { await sleep(250); return { ...parseProfile(this.#profile), ...parseButtonReport(this.#buttons) }; }
  async readMacro(id) { return { id, empty: true, events: [], truncated: false }; }
  async write(packet) {
    await sleep(300);
    const body = (from, to) => packet.slice(3, 3 + to - from);
    if (packet[0] === REPORT.DPI) this.#profile.splice(5, 47, ...body(5, 52));
    if (packet[0] === REPORT.POWER) this.#profile.splice(55, 8, ...body(55, 63));
    if (packet[0] === REPORT.POLLING) this.#profile[3] = packet[3];
    if (packet[0] === REPORT.BUTTONS) {
      this.#buttons.splice(3, 54, ...body(0, 54));
      const sum = this.#buttons.slice(3, 57).reduce((a, v) => a + v, 0) & 0xffff;
      this.#buttons.splice(57, 2, sum >> 8, sum & 0xff);
    }
  }
  async writeMacro() { await sleep(600); }
}
