// Pilotfish's mark, the lit fin: a fin over a waterline that is the LED, lit in the colour of the DPI level in use,
// so it reads at 16 px too. On a 64-unit grid. glyph() is the bare mark, for the header; tile() sits it on the dark
// tile, for the tab's icon.
const TILE = '#18181b';

// The pure LED colours (#0000ff…) sink into a dark ground; shapes filled with the colour take a lifted version.
export function lift(c, k = 0.28) {
  const n = parseInt(c.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
  return `#${ch.map(v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

// ink colours the fin itself: near-white on dark grounds, near-black on light ones.
const fin = (c, ink = '#ececec') => `<defs><filter id="pf-wl" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>
  <path d="M19 42c6-4 9-14 9-28 8 6 14 17 16 28z" fill="${ink}"/>
  <rect x="11" y="45" width="42" height="5" rx="2.5" fill="${c}" opacity=".9" filter="url(#pf-wl)"/>
  <rect x="11" y="45" width="42" height="5" rx="2.5" fill="${lift(c, 0.15)}"/>`;
const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;

export const glyph = (c, ink) => svg(fin(c, ink));
export const tile = c => svg(`<rect width="64" height="64" rx="14" fill="${TILE}"/>${fin(c)}`);
export const dataUrl = s => `data:image/svg+xml,${encodeURIComponent(s)}`;
