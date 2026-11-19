<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/media/banner-light.png">
  <img src="docs/media/banner-dark.png" alt="Pilotfish: the Attack Shark X11, set up from your browser" width="100%">
</picture>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#safe-by-design">Safe by design</a> ·
  <a href="#use-it">Use it</a> ·
  <a href="#development">Development</a>
</p>

Pilotfish is an open-source configurator for the **Attack Shark X11** wireless mouse. It runs in the browser and talks to
the mouse directly, over the USB cable, the 2.4 GHz receiver or Bluetooth. There is nothing to install and no server:
your settings go from the page to the mouse and nowhere else.

<p align="center">
  <img src="docs/media/demo.webp" alt="A tour of Pilotfish: pointing at the mouse's parts, changing its light, dragging a DPI level, turning the mouse over and testing its buttons" width="100%">
</p>

## Why

The X11 was my first gaming mouse, and I love it. Its official software is another story: it looks dated, it is hard to
find your way around, and even working out how a macro works takes guesswork. So I reverse-engineered the protocol and
made the app I wanted: the mouse itself is the interface. Point at a part to see what it does, touch it to change it, and
turn the mouse over to reach what is underneath.

## Features

- **The mouse is the interface.** Every part has a callout that says what it does. Touch one to change it; drag the
  mouse to turn it over and reach the DPI switch, the Mode switch, the sensor and the power switch.
- **DPI levels** as faders or a dial, from 50 to 22,000. The sensor's own limit is marked, and so is the level the next
  press of the DPI switch goes to.
- **Buttons.** Common actions, any key or key combination pressed on your keyboard, or a macro recorded from the
  keyboard, shown in time and played back before you save it.
- **Lighting**, previewed live on the drawing and on the desk around it: steady, breathing, neon or by DPI level.
- **Sensor and power.** Polling rate, angle snap, ripple control, key response and the sleep timer.
- **Profiles** with an icon each, one per game or task.
- **History.** Every setup your mouse has had is kept in the browser. Go back to any of them, undo the last change, or
  export everything to a file.
- **Test.** Every click and wheel step counted; a double-click detector for worn switches; the polling rate measured as
  the reports arrive.
- **Battery**, with the last week of readings and an estimate of the days left.
- Works offline once opened. English and Spanish, dark and light.

## Safe by design

Pilotfish changes settings on a real device, so it is careful about how:

- **It never touches the firmware.** It sends only configuration reports, the same ones the official software sends.
  There is no update or bootloader code in it at all.
- **Every value is checked** against the mouse's limits before a packet is built, and every packet comes from one tested
  module.
- **Every write is read back** to confirm that the mouse kept it. If it didn't, Pilotfish says so instead of guessing.
- **Over the receiver it only talks while the mouse is awake**, going by the battery heartbeat the mouse sends every two
  seconds. Requests sent to a sleeping mouse can leave the receiver stuck until it is plugged in again.
- **The setup is backed up before every change**, so any change can be taken back.

## Use it

You need a desktop browser with WebHID: **Chrome, Edge or Opera** on Windows, macOS or Linux. Firefox and Safari don't
support it. Bluetooth works where Web Bluetooth does.

1. Connect the X11 with its cable or its 2.4 GHz receiver.
2. Open Pilotfish and press **Connect the mouse**, then pick the X11 in the browser's list. From then on it connects
   on its own.
3. Change what you like. Nothing is written until you press **Apply**.

Close the official software while Pilotfish is open: two programs talking to the mouse at once can confuse it. On Linux,
Chrome needs permission to open the device; a udev rule for vendor `1d57` gives it.

## Development

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # protocol and backup tests, built from real USB captures
npm run build   # dist/, with the offline service worker
```

Open <http://localhost:5173/?demo> to run the whole interface against a simulated mouse, no hardware needed. The demo
exists only in development builds.

Pilotfish is a Svelte 5 + Vite app with no backend:

| Path | What it holds |
| --- | --- |
| `src/lib/protocol/` | Pure functions: parses reports, builds packets, checks that a read confirms a write. |
| `src/lib/device/` | The links (WebHID, Web Bluetooth, the demo) and the one place that writes to the mouse. |
| `src/lib/ui/` | The interface: the stage, the cards, the DPI dock, Test, profiles and history. |
| `src/lib/art/` | The drawing of the X11, its 3D turn in WebGL, and the mark. |
| `src/lib/i18n/` | English and Spanish. |

Protocol changes need a test built from real bytes, captured from the official software or the mouse.

## Credits

Made by [dau-in](https://github.com/dau-in). The mouse is an original illustration drawn for Pilotfish. The
interface is set in [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) and
[Doto](https://fonts.google.com/specimen/Doto), with [Pixelarticons](https://pixelarticons.com) for its icons; the credits
card adds [Yuji Syuku](https://fonts.google.com/specimen/Yuji+Syuku) and
[Noto Sans Math](https://fonts.google.com/noto/specimen/Noto+Sans+Math). All of them are open-source.

Pilotfish is an independent project. It is not affiliated with or endorsed by Attack Shark.
