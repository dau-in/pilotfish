// The last steps the links took, kept in memory only and never sent anywhere, so a report the user copies can say
// what happened before an error. Short lines, no settings: just what was asked and how it went.
const MAX = 40;
const steps = [];
const t0 = Date.now();

export function note(text) {
  steps.push(`${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s  ${text}`);
  if (steps.length > MAX) steps.shift();
}

export const recent = () => steps.slice();

export const hexBytes = (bytes, n = 3) => Array.from(bytes).slice(0, n).map(v => v.toString(16).padStart(2, '0')).join(' ');
