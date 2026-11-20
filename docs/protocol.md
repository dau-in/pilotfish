# The Attack Shark X11 configuration protocol

This is how Pilotfish talks to the Attack Shark X11, written so anyone can check it or build on it. It covers firmware
**1.12**, the only one we have seen. Everything here came from three sources: the official web driver's JavaScript, Frida
traces of the official Windows app, and reads from a real mouse. Every byte layout below is pinned by a test built from
those captures in [`test/protocol.test.js`](../test/protocol.test.js), and the code that builds and parses it is
[`src/lib/protocol/index.js`](../src/lib/protocol/index.js). When this page and the tests disagree, the tests win.

> [!WARNING]
> These reports change a real device. Read [Timing and safety](#timing-and-safety) before you send anything. Pilotfish
> never touches the firmware update path, and neither should anything built from this page.

**Contents:** [Devices](#devices) · [Conventions](#conventions) · [Reading](#reading) · [The profile](#the-profile) ·
[Writing](#writing) · [Notifications](#notifications) · [Bluetooth](#bluetooth) · [Timing and safety](#timing-and-safety) ·
[Still unknown](#still-unknown)

## Devices

| Link | IDs | Configuration channel |
| --- | --- | --- |
| USB cable | `1D57:FA55`, serial `X11_MOUSE-001` | HID feature reports |
| 2.4 GHz receiver | `1D57:FA60` | HID feature reports, the same layout as the cable |
| Bluetooth | shows up as `045E:0055` "RW-BLE-1.0", advertised as `X11mouse1` or `X11mouse2` | GATT, no feature reports |

Over USB, both the cable and the receiver expose interface `MI_02` with two collections Pilotfish uses:

- **Configuration:** usage page `0x0B` (`COL04`). 64-byte feature reports with IDs `04` … `0D`, `10` and `A0`. In WebHID, filter on `{ vendorId: 0x1d57, productId, usagePage: 0x0b }`.
- **Notifications:** usage page `0x0A` (`COL03`). Input report `03`, 5 bytes.

The receiver has other interfaces too, such as its media keys on usage page `0x0C`, which take no feature reports.
WebHID's chooser hands back **every interface** of the device picked, in no fixed order. Open the one whose collections
include usage page `0x0B`: on another owner's Windows 11 the media keys came first, and every write to them failed with
"Failed to write the feature report".

The sensor is a PixArt PAW3311. In every frame the mouse sends, it calls itself device number `0x55` (85).

## Conventions

- Byte 0 is the report ID. Offsets on this page count from it, so "offset 3" is the fourth byte of the report.
- Writes end in a 16-bit sum of their body bytes, **big endian**. The same sums read back inside the profile are **little endian**.
- Values that must be in range are checked before they are sent. Pilotfish throws rather than send a byte it did not expect.

## Reading

Nothing can be fetched directly: every read goes through the status report `A0`.

1. Send feature report `A0 <report> <arg> …` naming what you want.
2. Poll `GetFeature(A0)` until byte 1 is `01` (ready). Pilotfish polls every 60 ms, 15 times at most.
3. Fetch `GetFeature(<report>)`.

| Request (`A0 …`) | Answer | What it holds |
| --- | --- | --- |
| `A0 0B 08 00 00 00 00 00` | `0B 08 01 12` | Firmware version: `01 12` = 1.12 |
| `A0 0A 80 00 01 00 00 00` | `0A 80 01 …`, 128 bytes | [The profile](#the-profile) |
| `A0 08 3B 00 01 00 00 00` | `08 3B 01 …`, 59 bytes | The buttons alone, the same layout as the [buttons write](#08-buttons) |
| `A0 09 83 00 <id> 00 00 00` | `09 83 <id> …`, 131 bytes | A whole [macro](#09-macros) |
| `A0 09 40 00 <id> 00 00 00` | `09 40 <id> …`, 64 bytes | A macro's first 64 bytes: its header and first 17 steps |

- **The first request after a while idle is sometimes ignored.** Retry the whole exchange. The official app does too.
- **WebHID returns at most 64 bytes** of a feature report, which is what the descriptor declares. That cuts the profile
  off before its buttons and a macro after 17 steps. So Pilotfish reads the profile, then reads the buttons on their own,
  and keeps the macros it writes to 17 steps. Native HID (hidapi) gets the full 128 bytes with
  `get_feature_report(0x0A, 128)`. With 64 it gets only the first half, and 65, 127 or 129 fail.
- Depending on the platform, WebHID returns a report with or without its ID byte. Check byte 0 to tell which.

## The profile

Report `0A`, 128 bytes, read as above. Here is a real one, the first 64 bytes as the official app read them:

```
0a 80 01 01 fe 00 01 3f 20 20 12 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01 ff 00 00 00 ff 00 00 00 ff
ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff ff 02 00 69 0f 00 03 a8 00 ff 00 01 04 af
```

That is 1000 Hz, levels of 800, 1600, 2400, 3200, 5000 and 22000 DPI in red, green, blue, yellow, cyan and magenta,
level 1 in use, ripple control on, angle snap off, sleep after 10 minutes, and key response 8 ms.

| Offset | Field |
| --- | --- |
| 3, 4 | Polling rate and its complement (`~rate & 0xFF`); see [`06`](#06-polling-rate) |
| 5 … 51 | The DPI block: bytes 3 … 49 of the [`04` write](#04-dpi), byte for byte |
| 52 | Unknown, `00` as read |
| 53, 54 | Sum of the DPI block, little endian |
| 55 … 62 | The light and power block: bytes 3 … 10 of the [`05` write](#05-light-sleep-and-key-response) |
| 63, 64 | Sum of 55 … 62, little endian |
| 65 … 118 | Buttons: 18 slots × `[function, p1, p2]`, as in the [`08` write](#08-buttons) |
| 119, 120 | Sum of 65 … 118, little endian |

Because the profile carries the bodies of the writes, every write is built from the last read: change the bytes you
mean to change, and copy back the ones you don't understand.

## Writing

Each write is one feature report on the configuration collection, padded to 64 bytes. Byte 1 is its length.

### `04` DPI

```
04 38 01 <angleSnap> <ripple> <levelMask> <xDoubled> <yDoubled> <8 × dpiX> <8 × dpiY> <active>
<8 × R G B> <indication> <sumHi> <sumLo> 00 00 00 00
```

| Offset | Field |
| --- | --- |
| 3 | Angle snap: 0 off, 1 on |
| 4 | Ripple control: 0 off, 1 on |
| 5 | Levels enabled, one bit each; `3F` = levels 1 to 6 |
| 6, 7 | "Doubled" flags, one bit per level, for X and Y. The official app sets both; the web driver only X. |
| 8 … 15 | Sensor value per level, X |
| 16 … 23 | Range per level: 0 up to 10,000 DPI, 1 above |
| 24 | The level in use, 1 to 6 |
| 25 … 48 | One colour per level (R, G, B). The X11 uses six of the eight slots. |
| 49 | Indication type, `02` as read; kept |
| 50, 51 | Sum of bytes 3 … 49, big endian |

**Encoding a DPI value.** The sensor takes a value from a 220-entry table, `SENSOR_TABLE` in the code, copied verbatim
from the official driver:

1. Round to what the sensor can do: steps of 50 up to 10,000, then steps of 100 up to 12,000.
2. Above 12,000, halve the value and set the level's doubled bit. The firmware doubles it, so 12,200 to 22,000 go in
   steps of 200.
3. Table index = `(dpi − 50) / 50` up to 10,000 (range byte 0), or `199 + (dpi − 10000) / 100` above (range byte 1).

| DPI | Value | Range | Doubled |
| --- | --- | --- | --- |
| 50 | `01` | 0 | no |
| 800 | `12` | 0 | no |
| 10,000 | `EB` | 0 | no |
| 10,100 | `76` | 1 | no |
| 12,000 | `8D` | 1 | no |
| 12,200 | `8F` | 0 | yes |
| 22,000 | `81` | 1 | yes |

The official web driver's `calculateActualDpi` (value × 50) is wrong for the X11. Decode by looking the value up in the
table.

For example, this is what the official app sent to set level 1 of the profile above to 900 DPI:

```
04 38 01 00 01 3f 20 20 15 25 38 4b 75 81 01 01 00 00 00 00 00 01 00 00 01 ff 00 00 00 ff 00 00 00 ff ff ff 00
00 ff ff ff 00 ff ff 40 00 ff ff ff 02 0f 6c 00 00 00 00
```

### `05` Light, sleep and key response

The X11 keeps its power settings inside the lighting report:

```
05 0F 01 <mode << 4> <sleepHi | speed> <sleepLo | brightness> R G B <sleepRaw> <response / 2> <sumHi> <sumLo> 00 00
```

| Offset | Field |
| --- | --- |
| 3 | Light mode in the high nibble: 0 off, 1 steady, 2 breathing, 3 neon, 4 colour breathing, 5 steady by DPI, 6 breathing by DPI |
| 4 | Low nibble: speed, 1 to 8. High nibble: sleep minutes ÷ 16. |
| 5 | Low nibble: brightness, 1 to 8. High nibble: sleep minutes mod 16. |
| 6 … 8 | Light colour |
| 9 | Unknown, kept as read |
| 10 | Key response in ms ÷ 2: 4 to 50 ms in steps of 2 |
| 11, 12 | Sum of bytes 3 … 10, big endian |

So sleep = `(byte4 & 0xF0) | (byte5 >> 4)` minutes. With speed 3 and brightness 8, 10 minutes is `03 A8`, 15 is `03 F8`
and 30 is `13 E8`. The official web driver's builder adds a second sum; the X11 ignores it.

The official app offers sleep from 1 minute, but **1 minute written over the receiver dropped the link**: the light blinked
fast red until the receiver was plugged in again. Pilotfish allows 2 to 60.

Example from the official app, steady green light, sleep after 10 minutes, 8 ms:

```
05 0f 01 10 03 a8 00 ff 00 01 04 01 bf 00 00
```

### `06` Polling rate

```
06 09 01 <rate> <~rate & 0xFF> 00 00 00 00
```

Rate: `08` = 125 Hz, `04` = 250, `02` = 500, `01` = 1000. For example, 500 Hz is `06 09 01 02 fd 00 00 00 00`. Over
Bluetooth the rate is fixed, and the official app does not offer it either.

### `08` Buttons

```
08 3B 01 <18 × [function, p1, p2]> <sumHi> <sumLo>
```

The sum covers the 54 slot bytes, big endian. Slots the X11 really has:

| Slot | Button | Factory function |
| --- | --- | --- |
| 0 | Left | `02` left click |
| 1 | Right | `03` right click |
| 2 | Wheel click | `04` middle click |
| 5 | DPI switch, underneath | `0D` DPI cycle |
| 6 | Front side button | `06` forward |
| 7 | Rear side button | `05` back |
| 16 | Wheel down | `09` scroll down |
| 17 | Wheel up | `0A` scroll up |

The other slots are unused. They read back as `00 00 00` but are written as `01 00 00` (off), as the official app does.

| Code | Function | Code | Function |
| --- | --- | --- | --- |
| `01` | Off | `11` | Key combination: `p1` = modifiers, `p2` = key |
| `02` … `06` | Left, right, middle click, back, forward | `12` | Macro: `p2` = macro number |
| `07` | Double click | `15` … `1C` | Media: player, previous, next, play/pause, stop, mute, volume up, down |
| `08` | Rapid fire | `1D`, `1E`, `23` | Calculator, mail, This PC |
| `09`, `0A` | Scroll down, up | `20` … `26` | Browser: forward, back, stop, …, reload, home, search |
| `0D` … `0F` | DPI cycle, up, down | `28`, `29`, `2B` | Cycle polling rate, cycle light, show battery |

For a key combination, the modifiers are Ctrl `1`, Shift `2`, Alt `4` and Win `8`, and the key is its USB HID usage ID
(`a` = `04` … `z` = `1D`, Tab = `2B`, F1 = `3A`). So `[11, 01, 06]` is Ctrl + C and `[11, 0A, 16]` is Win + Shift + S.

Pilotfish refuses any write that leaves no button on left click.

### `09` Macros

There is one macro per button. Its number is the button's slot + 1: left 1, right 2, wheel 3, DPI 6, front side 7, rear
side 8, wheel down 17, wheel up 18. A button plays its macro once it is assigned `[12, 00, <number>]`.

The macro, 131 bytes:

```
09 83 <number> <mode> 00 00 00 <loops> <20 × 00> <count> <actions …> <sumHi @129> <sumLo @130>
```

| Offset | Field |
| --- | --- |
| 3 | Mode: 0 play a number of times, 1 until a key is pressed, 2 while held. An empty slot reads `FF` here. |
| 7 | Times to play (1 to 255), in mode 0 |
| 8 … 27 | A name, written as zeros |
| 28 | Number of actions |
| 29 … | Actions, two bytes each: `[flags | delay, usage]` |
| 129, 130 | Sum of bytes 3 up to the last action, big endian |

In an action's first byte, bit 7 means key up and bit 0 is always set. The rest is the delay before the action in 10 ms
units, so delays go in steps of 20 ms, up to 1,260 ms. A longer delay takes two more bytes, `[delay ÷ 200 ms, 03]`, and
counts as one more action.

**The macro is written in pieces.** Bytes 3 … 130 go in chunks of 60, each sent as `09 <4 + n> <number> <chunk> <n bytes>`,
about half a second apart. This is the official app recording "ab" for the rear side button. Trailing zeros are dropped
here; each piece is padded to 64 bytes:

```
09 40 08 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 04 01 04 81 04 01 05 81 05
09 40 08 01
09 0c 08 02 00 00 00 00 00 00 01 1b
```

Read back, the sum comes little endian.

## Notifications

Over USB, input report `03` on the notification collection:

```
03 55 40 <state> <level>
```

This is the battery heartbeat. It comes **only over the receiver**, about every 2 seconds while the mouse is linked, and
further apart once it is left still. State: `01` on battery (level in %), `02` full or on the cable, `03` charging (we have
not seen this one live yet). `03 55 40 01 64` is on battery, 100 %; `03 55 40 02 64` is resting on the dock, full.

Any other report `03` means something changed on the mouse, for example the DPI switch was pressed, so read the
profile again. Don't re-read on the heartbeat, or you will read every 2 seconds.

## Bluetooth

Over Bluetooth the X11 has no feature reports. Its configuration goes through the GATT service `FEE0`, using the same
packets as USB:

- **Write** the packet to characteristic `FEE3`: `04 38 01 …`, `05 0F 01 …`, `08 3B 01 …`.
- **Answers and notices** arrive on `FEE4`, once notifications are enabled on it.
- **Read** by writing `<cmd> 08 00 00 00 00 00 00` to `FEE3`. The answer starts with the same byte:
  - `A1` returns `a1 01 12`, the firmware version (1.12).
  - `A0` returns `a0` followed by the profile from offset 3: 118 bytes, buttons included, in one message. The high byte
    of the button sum is missing, so recompute it.
  - `A2` returns `a2 01 fe 05 ff`, not decoded.
- **The X11 sends every answer twice.** Match each answer to its request, and ignore the repeat.

Notices on `FEE4`:

| Notice | Meaning |
| --- | --- |
| `55 40 <state> <level>` | Battery, as report `03` without its ID; about every 5 s |
| `55 50 <status> <report>` | A write was acknowledged; status `00` = stored |
| `55 10 <level> 00` | The DPI switch was pressed; `level` is the new one |

To pair, set the power switch to Bluetooth and hold the Mode button underneath for 3 seconds, until its light blinks
fast. Each channel pairs on its own and has its own name: `X11mouse1` (green) and `X11mouse2` (blue). The browser's chooser
lists only devices that are advertising, so a mouse already connected to the system does not appear.

> [!CAUTION]
> The X11 also exposes `F000FFC0-0451-4000-B000-000000000000`, TI's over-the-air firmware update service. Don't open it.

## Timing and safety

Each of these rules came from a real failure on the real mouse.

- **Confirm every write.** Over the receiver, a write still on its way is dropped without any error if another request
  arrives first. It happened: a factory-reset write of level 1 was lost and went through on the second send. Pilotfish
  reads the profile after each write and compares the bytes it sent. If they don't match, it sends once more, then gives up.
- **Let it settle.** After a write, Pilotfish stays quiet 80 ms on the cable and 2 s through the receiver, and waits half a
  second between macro chunks.
- **Don't insist.** Many writes in quick succession through the receiver stopped the mouse from answering until it was
  plugged in again.
- **Over the receiver, only talk while the heartbeat comes.** No heartbeat means the mouse is asleep or out of range.
  Requests sent then are lost. Once the receiver was left blinking fast red (pairing) until it was replugged, probably
  from requests sent while the mouse slept. After a
  silence, Pilotfish waits for two heartbeats before sending anything.
- **One program at a time.** Two clients interleaving requests on the configuration channel wedged it until the cable was
  replugged. Close the official app first.
- **Never leave the mouse without a left click.**

## Still unknown

- Offsets 52 and 61 of the profile, and the `A2` answer over Bluetooth.
- What feature reports `07`, `0C`, `0D` and `10` do. Pilotfish never sends them.
- How to empty a macro slot.
- Reading a macro past 64 bytes through WebHID.
- Macros over Bluetooth: not captured yet, so Pilotfish doesn't offer them there.
- The charging state `03` of the heartbeat, live.

Found something new? Open an issue with the capture: the bytes from the official software or the mouse, not invented ones.
