// Test: the real mouse, as the browser sees it. Every press is counted and drawn on the click log; a press that
// comes back faster than a finger can is a worn switch double-clicking; a wheel step against the way it is turning
// is a worn wheel; and each pointer report is a dot, so the polling rate shows and can be counted. Nothing is sent
// to the mouse and nothing is kept.
import { lift } from '../art/mark.js';

const FAULT_MS = 30, JUMP_MS = 80, SPAN = 8000;
// The browser's button numbers, and the part of the drawing each one is.
export const BTN = { 0: 'left', 1: 'wheel', 2: 'right', 3: 'back', 4: 'forward' };
export const ROWS = ['left', 'right', 'wheel', 'back', 'forward', 'scroll'];

const fresh = () => ({
  btn: Object.fromEntries([0, 1, 2, 3, 4].map(b => [b, { n: 0, faults: [], lastUp: 0 }])),
  wheel: { up: 0, down: 0, jumps: 0, last: 0, dir: 0 },
  cps: 0, best: 0, hz: 0,
});
export const lab = $state(fresh());

// The parts of the run that change every frame stay out of the reactive state.
let marks = [], ticks = [], raw = [], pts = [], presses = [];
let ctx = null, raf = 0, meter = 0;

// stin: the stage, where clicks and scrolling count; faceTop: the drawing whose parts go down; strip and trail: the
// click log and the stage's canvas; color(): the level's colour, for the dots.
export function start(c) {
  stop();
  Object.assign(lab, fresh());
  marks = []; ticks = []; raw = []; pts = []; presses = [];
  ctx = c;
  addEventListener('mousedown', onDown);
  addEventListener('mouseup', onUp);
  addEventListener('auxclick', prevent);
  c.stin.addEventListener('wheel', onWheel, { passive: false });
  c.stin.addEventListener(RAW, onRaw);
  meter = setInterval(measure, 120);
  raf = requestAnimationFrame(draw);
}

export function stop() {
  if (!ctx) return;
  removeEventListener('mousedown', onDown);
  removeEventListener('mouseup', onUp);
  removeEventListener('auxclick', prevent);
  ctx.stin.removeEventListener('wheel', onWheel);
  ctx.stin.removeEventListener(RAW, onRaw);
  clearInterval(meter); cancelAnimationFrame(raf);
  ctx.faceTop().querySelectorAll('.part.down').forEach(el => el.classList.remove('down'));
  ctx = null;
}

const inStage = t => ctx.stin.contains(t);
const prevent = e => e.preventDefault();
const press = (part, on) => ctx.faceTop().querySelectorAll(`[data-part="${part}"]`).forEach(el => el.classList.toggle('down', on));

function onDown(e) {
  if (!inStage(e.target) || e.target.closest('button, a')) return;
  const part = BTN[e.button]; if (!part) return;
  e.preventDefault();
  const now = performance.now(), b = lab.btn[e.button], gap = b.lastUp ? now - b.lastUp : Infinity, fault = gap < FAULT_MS;
  b.n++;
  if (fault) b.faults.push(Math.round(gap));
  marks.push({ row: part, t0: now, t1: 0, fault, gap: Math.round(gap) });
  if (e.button === 0) presses.push(now);
  press(part, true);
}
function onUp(e) {
  // Keeps the side buttons from taking the page back or forward.
  if (e.button === 3 || e.button === 4) e.preventDefault();
  const part = BTN[e.button]; if (!part) return;
  const now = performance.now();
  lab.btn[e.button].lastUp = now;
  for (let i = marks.length - 1; i >= 0; i--) if (marks[i].row === part && !marks[i].t1) { marks[i].t1 = now; break; }
  press(part, false);
}

let ribY = 0;
function onWheel(e) {
  if (!e.deltaY) return;
  e.preventDefault();
  const now = performance.now(), dir = e.deltaY > 0 ? 1 : -1, W = lab.wheel;
  // One step against the way you are scrolling, straight after the others: a worn wheel.
  const jump = W.dir && dir !== W.dir && now - W.last < JUMP_MS;
  if (dir > 0) W.down++; else W.up++;
  if (jump) W.jumps++;
  W.dir = dir; W.last = now;
  ticks.push({ t: now, dir, jump });
  // The wheel's ribs roll on the drawing.
  ribY += dir > 0 ? -11 : 11;
  ctx.faceTop().querySelector('pattern.ribs')?.setAttribute('patternTransform', `translate(0 ${ribY})`);
}

// Each raw report from the mouse is one event: their dots show the polling rate, and counting them measures it.
const RAW = typeof window !== 'undefined' && 'onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove';
function onRaw(e) {
  const r = ctx.stin.getBoundingClientRect(), list = RAW === 'pointermove' && e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of list.length ? list : [e]) { raw.push(ev.timeStamp); pts.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, t: performance.now() }); }
}
function measure() {
  const now = performance.now();
  presses = presses.filter(t => now - t < 1000);
  lab.cps = presses.length; lab.best = Math.max(lab.best, lab.cps);
  raw = raw.filter(x => now - x < 500);
  const span = raw.length > 8 ? raw.at(-1) - raw[0] : 0;
  lab.hz = span > 60 && now - raw.at(-1) < 150 ? Math.round(((raw.length - 1) / span) * 1000) : 0;
}

export const faults = () => Object.values(lab.btn).reduce((n, b) => n + b.faults.length, 0) + lab.wheel.jumps;

function fit(cv) {
  const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  return [g, w, h];
}
function draw() {
  if (!ctx) return;
  const now = performance.now();
  // The trail: a dot for every report, fading over half a second.
  const [tx] = fit(ctx.trail());
  pts = pts.filter(p => now - p.t < 520);
  tx.fillStyle = lift(ctx.color(), 0.32);
  for (const p of pts) { tx.globalAlpha = 1 - (now - p.t) / 520; tx.beginPath(); tx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); tx.fill(); }
  tx.globalAlpha = 1;
  // The click log: the last eight seconds, a row per button and one for the wheel.
  const [g, w, h] = fit(ctx.strip());
  const X = t => w - ((now - t) / SPAN) * w, rh = h / ROWS.length;
  const rs = getComputedStyle(document.documentElement), ink = rs.getPropertyValue('--ink-2').trim(), gridA = +rs.getPropertyValue('--grid-a');
  g.lineWidth = 1;
  for (let s = 0; s <= 8; s++) { const x = Math.round(w - (s / 8) * w) + 0.5; g.strokeStyle = `rgb(${ink} / ${gridA})`; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let r = 0; r < ROWS.length; r++) { const y = Math.round(r * rh + rh / 2) + 0.5; g.strokeStyle = `rgb(${ink} / ${gridA * 1.4})`; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.font = `600 10px ${rs.getPropertyValue('--f-text')}`; g.textBaseline = 'middle';
  marks = marks.filter(m => !m.t1 || now - m.t1 < SPAN + 200);
  for (const m of marks) {
    const y = ROWS.indexOf(m.row) * rh + rh / 2, x0 = X(m.t0), x1 = Math.max(x0 + 3, X(m.t1 || now));
    g.fillStyle = m.fault ? '#e5566f' : `rgb(${ink} / .85)`;
    g.beginPath(); g.roundRect(x0, y - 4, x1 - x0, 8, 2); g.fill();
    if (m.fault) g.fillText(ctx.ms(m.gap), x1 + 5, y);
  }
  ticks = ticks.filter(k => now - k.t < SPAN + 200);
  const sy = 5 * rh + rh / 2;
  g.lineWidth = 2;
  for (const k of ticks) { const x = Math.round(X(k.t)) + 0.5; g.strokeStyle = k.jump ? '#e5566f' : `rgb(${ink} / .85)`; g.beginPath(); g.moveTo(x, sy); g.lineTo(x, sy + (k.dir > 0 ? 6 : -6)); g.stroke(); }
  raf = requestAnimationFrame(draw);
}
