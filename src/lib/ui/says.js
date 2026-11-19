// What each part of the mouse says about itself: a value for its callout (a word, or a figure and its unit), and a
// line of detail for the list of parts on a phone. d is the draft; the connection and battery come from the mouse.
import { mouse } from '../device/mouse.svelte.js';
import { t } from '../i18n/index.svelte.js';
import { daysLeft } from './battery.svelte.js';
import { actionLabel, same } from './shared.js';

const raw = (s, id) => s?.buttons?.find(b => b.id === id)?.raw;
const doesWhat = (s, id) => { const r = raw(s, id); return r ? actionLabel(r) : t('buttons.unknown'); };
const kindNow = () => mouse.kind ?? 'dongle';

export function says(id, d) {
  const kind = kindNow(), bat = mouse.battery;
  switch (id) {
    case 'wheel': return { v: doesWhat(d, 'wheel'), sub: t('say.wheel', { up: doesWhat(d, 'wheel-up'), down: doesWhat(d, 'wheel-down') }) };
    case 'led': return { v: t(`lightMode.${d.lighting.mode}`), sub: d.lighting.mode ? t('say.brightness', { n: d.lighting.brightness }) : t('say.dark') };
    case 'dpi': return { v: doesWhat(d, 'dpi'), sub: raw(d, 'dpi')?.[0] === 13 ? t('say.cycle') : '' };
    case 'pair': return { v: t(kind === 'bluetooth' ? 'say.pairOn' : 'say.pair'), sub: t('say.pairHow') };
    case 'power': return { v: t(`say.power.${kind}`), sub: t('say.sleeps', { n: d.sleepMinutes }) };
    case 'sensor': {
      const sub = t('say.sensor', { snap: d.angleSnap, ripple: d.ripple });
      return mouse.canChangePolling && d.pollingHz ? { n: d.pollingHz, u: 'Hz', sub } : { v: t('say.sensorBle'), sub };
    }
    case 'contacts': {
      if (!bat) return { v: t('say.batteryUnread') };
      const days = bat.state === 'battery' ? daysLeft(bat.level) : null;
      return { n: bat.state === 'full' ? 100 : bat.level, u: '%', sub: bat.state === 'battery' ? (days ? t('battery.daysShort', { n: days }) : '') : t(`battery.${bat.state}Now`) };
    }
    case 'bay': return { v: t(kind === 'dongle' ? 'say.bayInUse' : 'say.bayStored'), sub: t(kind === 'dongle' ? 'say.bayInUseSub' : 'say.bayStoredSub') };
    case 'usbc': return { v: t(kind === 'cable' ? 'say.usbcOn' : 'say.usbc'), sub: t('say.usbcSub') };
    default: return { v: doesWhat(d, id) };
  }
}
export const plain = c => c.v ?? `${c.n} ${c.u}`;

// A part whose settings are edited but not applied yet carries a dot.
export function changedPart(id, d, p) {
  if (!d || !p) return false;
  const slot = s => !same(raw(d, s), raw(p, s));
  if (id === 'wheel') return ['wheel', 'wheel-up', 'wheel-down'].some(slot);
  if (id === 'led') return !same(d.lighting, p.lighting);
  if (id === 'sensor') return d.pollingHz !== p.pollingHz || d.angleSnap !== p.angleSnap || d.ripple !== p.ripple || d.keyResponseMs !== p.keyResponseMs;
  if (id === 'power') return d.sleepMinutes !== p.sleepMinutes;
  if (['left', 'right', 'forward', 'back', 'dpi'].includes(id)) return slot(id);
  return false;
}
