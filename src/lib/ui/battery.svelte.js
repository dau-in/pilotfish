// The battery over the last week, from the readings the mouse sends on its own (the heartbeat over the receiver,
// a notice over Bluetooth). Kept in this browser: a reading when the level changes, or every half hour at most
// while it holds, so a week stays a few hundred points.
const KEY = 'pilotfish.battery';
const WEEK = 7 * 24 * 3600e3;
const HOLD_MS = 30 * 60e3;

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(p => Number.isFinite(p?.at) && Number.isFinite(p?.level)) : [];
  } catch {
    return [];
  }
}

export const battery = $state({ log: load() });

// b: the mouse's battery report, { state: 'battery' | 'charging' | 'full', level }.
export function note(b, now = Date.now()) {
  if (!b || !Number.isFinite(b.level)) return;
  const log = battery.log, last = log.at(-1), charging = b.state !== 'battery';
  if (last && last.level === b.level && last.charging === charging && now - last.at < HOLD_MS) return;
  battery.log = [...log.filter(p => now - p.at < WEEK), { at: now, level: b.level, charging }];
  try { localStorage.setItem(KEY, JSON.stringify(battery.log)); } catch { /* this visit only */ }
}

// Days left at the pace of the readings kept: what it lost on battery, over the time it spent on battery. Null until
// there is a few hours of it to go by.
export function daysLeft(level) {
  let lost = 0, spent = 0;
  const log = battery.log;
  for (let i = 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i];
    if (a.charging || b.charging || b.at - a.at > 6 * 3600e3) continue;
    spent += b.at - a.at;
    lost += Math.max(0, a.level - b.level);
  }
  if (spent < 4 * 3600e3 || lost < 2) return null;
  const perDay = lost / (spent / 86400e3);
  return Math.max(1, Math.round(level / perDay));
}
