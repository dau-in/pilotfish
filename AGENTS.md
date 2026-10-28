# AGENTS.md

Guidance for AI coding agents working on Pilotfish. Humans: start with the README.

Pilotfish configures the Attack Shark X11 mouse from the browser. It is a Svelte 5 + Vite PWA with no backend: the page talks to the mouse directly over WebHID (USB cable and 2.4 GHz receiver) and Web Bluetooth.

## Commands

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # node --test: protocol tests built from real USB captures
npm run build        # dist/, including the generated service worker (sw.js)
```

Open `http://localhost:5173/?demo` to run the whole UI against a simulated mouse (`src/lib/device/demo.js`, dev builds only). Use it for any UI work. Never point an automated session at a real mouse.

## Layout

- `src/lib/protocol/index.js`: pure functions. Parses reports, builds packets, and decides whether a read confirms a write. No DOM, no I/O. Every byte layout is tested in `test/protocol.test.js`.
- `src/lib/device/`: the transports. `hid.js` (WebHID) and `ble.js` (Web Bluetooth) expose the same link interface. `mouse.svelte.js` is the app-wide device state and the only place that writes to the mouse. `demo.js` is the fake link.
- `src/lib/ui/`: screens and components. `studio.svelte.js` holds the draft the user edits before applying.
- `src/lib/i18n/`: `en.js` (complete, the source of truth), `es.js` (may omit keys) and the `t()` helper.
- `vite.config.js`: also writes the offline service worker at build time.

## Safety rules (hard)

These protect real hardware. Do not relax them without the maintainer's explicit approval.

1. **Never touch firmware.** Do not use or add code for the Bluetooth service `F000FFC0-0451-4000-B000-000000000000` (TI over-the-air firmware update), or any update or bootloader path. Pilotfish only sends configuration reports.
2. **Only send packets the protocol module builds.** Every value is range-checked there and throws a `MouseError` when out of range. Do not hand-craft byte arrays in UI or device code.
3. **Confirm every write.** `mouse.svelte.js` writes, then reads back until `confirms()` passes. It resends once at most, then gives up. Over the receiver a write is silently lost if another request follows too soon, and insisting can wedge the receiver until it is replugged. Keep the settle delays (`SETTLE_MS`) and the confirmation loop.
4. **Over the receiver, only talk while the mouse is linked.** The mouse sends a battery heartbeat about every 2 s. With no recent heartbeat it is asleep or out of range, and nothing may be sent.
5. **One program at a time.** Two clients interleaving requests on the config channel can wedge the firmware until a replug. Tests and scripts must not run against a mouse that a browser tab is using.
6. Never leave the mouse without a left click; `buildButtonPacket` enforces this.

## Conventions

- **No user-facing string in code.** Add a key to `en.js`, and to `es.js` if you can. Use `t('key', vars)`. Use a function entry for sentences that change shape (plurals, optional parts).
- **Errors** from protocol and device code are `new MouseError('code', vars)`. The UI words them through `error.<code>` keys.
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`). An `$effect` that writes state it also reads must use `untrack`.
- Comments explain why, not what. Match the density of the surrounding code.
- Protocol changes need a test built from a real capture: bytes from the official software or the device, not invented ones.
- UI work: no generic "AI look". No decorative glass, stock gradients or neon. Any gradient or motion must come from the device's real state, such as its LED color. Check narrow layouts too.
- Commits: short, imperative, in English.

## Not in this repo

Reverse-engineering notes, raw captures and probe scripts live outside the repository. Prefer the tests as the reference for byte layouts.
