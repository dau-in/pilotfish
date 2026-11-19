// The stage's moving parts, the ones that need the pixels: the mouse drawn at its size, its callouts placed level with
// their parts and joined to them by leaders, the card beside it, and the mouse picked up and turned over in WebGL.
// Svelte renders what the callouts and the card say; this module only measures and places them, and draws.
import { X11 } from '../../art/x11.js';
import { TURN } from '../../art/turn.js';
import { FACE_ORDER, PARTS, compact, listMode, reduced, view } from '../view.svelte.js';

const ANCHOR = X11.ANCHORS;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wait = ms => new Promise(r => setTimeout(r, ms));
const frameAfter = () => new Promise(r => requestAnimationFrame(r));
// The drawing names Bluetooth "ble", as the switch's stop.
const drawLink = kind => (kind === 'bluetooth' ? 'ble' : kind ?? 'dongle');
const KNOB_Y = { dongle: 0, cable: 36, ble: 72 };

// els: the stage's elements. ctx: what the stage reads from the app, as functions so they are always current:
// shell(), link(), led() (the LED colour now), label(face), area() (the part of the stage free of header and dock).
export function createStage(els, ctx) {
  const { stage, stin, mouse: mouseEl, faceTop, faceUnder, turnCv, lines, callouts, card, shadow, halo, pool, orbit } = els;
  let turn = null;
  try { turn = TURN.create(turnCv, X11.BODY_DRAWN); } catch { turn = null; }
  let box = { x: 0, y: 0, w: 0, h: 0 }, gut = 60;
  const lineY = {};
  const faceEl = f => (f === 'top' ? faceTop : faceUnder);

  /* ---------- Drawing ---------- */
  function drawFaces() {
    faceTop.innerHTML = X11.top(ctx.shell(), { u: 'pt', label: ctx.label('top') });
    faceUnder.innerHTML = X11.under(ctx.shell(), drawLink(ctx.link()), { u: 'pu', label: ctx.label('under') });
    const body = `<svg viewBox="0 0 760 1523" aria-hidden="true"><path d="${X11.BODY_DRAWN}"/></svg>`;
    halo.innerHTML = body; shadow.innerHTML = body;
    outlines(); setHoverMarks();
    scheduleBake();
  }
  // The shape of the shell, for the glint of a new one.
  mouseEl.style.setProperty('--body', `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 1523" preserveAspectRatio="none"><path d="${X11.BODY_DRAWN}"/></svg>`)}")`);

  // A new shell: the old one is drawn once more over the new and wiped off from the left, a glint running along the
  // edge of the wipe like light across fresh plastic. Its own ids, so its gradients don't borrow the new face's.
  let wipe = 0;
  function setShell(old) {
    clearTimeout(wipe); mouseEl.querySelectorAll('.ghost, .shellglint').forEach(n => n.remove());
    if (old && !reduced() && box.h) {
      const ghost = document.createElement('div'), glint = document.createElement('div');
      ghost.className = 'face ghost'; glint.className = 'shellglint';
      ghost.innerHTML = view.face === 'top' ? X11.top(old, { u: 'gt' }) : X11.under(old, drawLink(ctx.link()), { u: 'gu' });
      mouseEl.append(ghost, glint);
      wipe = setTimeout(() => { ghost.remove(); glint.remove(); }, 1150);
    }
    drawFaces();
    // The 3D textures are redrawn after the wipe: drawn during it, they would hold it up for a moment.
    scheduleBake(1250);
  }

  /* ---------- Layout: the mouse centred, its callouts either side ---------- */
  function layout() {
    const W = stin.clientWidth;
    let H = stin.clientHeight;
    gut = compact() ? 30 : 60;
    // On a tablet the stage is tall, so the mouse is large and its callouts fit round it; on a phone it's shorter.
    if (compact()) {
      H = listMode() ? clamp(Math.round(innerHeight * 0.56), 340, 500) : clamp(Math.round(innerHeight * 0.6), 460, 760);
      stin.style.setProperty('--sh', `${H}px`);
    } else stin.style.removeProperty('--sh');
    const A = ctx.area();
    const h = Math.max(120, listMode() ? H - 44 : Math.min(A.bottom - A.top - 48, 720));
    const w = h * 760 / 1523;
    box = { x: (W - w) / 2, y: listMode() ? 22 : A.top + 24, w, h };
    for (const el of [mouseEl, shadow, halo]) Object.assign(el.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${w}px`, height: `${h}px` });
    const R = h * 1.25, k = h / 1523;
    Object.assign(pool.style, { left: `${box.x + 380 * k - R}px`, top: `${box.y + 772 * k - R}px`, width: `${2 * R}px`, height: `${2 * R}px` });
    // The turning mouse needs room on every side: it swings out sideways and comes towards you as it lifts.
    const cw = w * 2.4, ch = h * 1.3;
    Object.assign(turnCv.style, { left: `${box.x + w / 2 - cw / 2}px`, top: `${box.y + h / 2 - ch / 2}px`, width: `${cw}px`, height: `${ch}px` });
    // The turn-over control sits in the gutter by the mouse's lower right, where no leader runs.
    els.turnbtn.style.left = `${box.x + box.w + 12}px`; els.turnbtn.style.top = `${box.y + box.h - 52}px`;
    stin.style.setProperty('--cx', `${box.x + w / 2}px`); stin.style.setProperty('--cy', `${box.y + h * 0.45}px`);
    placeOrbit();
    if (!listMode()) placeCallouts();
    placeCard();
    drawLines();
    scheduleBake();
  }

  /* ---------- Callouts ---------- */
  const calloutOf = id => callouts.querySelector(`[data-callout="${id}"]`);
  function placeCallouts() {
    const k = box.h / 1523, A = ctx.area();
    for (const side of ['l', 'r']) {
      const items = FACE_ORDER[view.face].filter(id => PARTS[id].side === side).map(id => {
        const el = calloutOf(id);
        // Each callout's value line sits level with its part, so the leader runs straight across.
        return el && { id, el, h: el.offsetHeight, want: box.y + ANCHOR[id][1] * k - 28 };
      }).filter(Boolean);
      let next = A.top + 12;
      for (const it of items) { it.top = Math.max(it.want, next); next = it.top + it.h + 16; }
      let limit = A.bottom - 12;
      for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (it.top + it.h > limit) it.top = limit - it.h; limit = it.top - 16; }
      for (const it of items) {
        it.el.style.top = `${it.top}px`;
        if (side === 'l') { it.el.style.left = 'auto'; it.el.style.right = `${stin.clientWidth - box.x + gut}px`; }
        else { it.el.style.right = 'auto'; it.el.style.left = `${box.x + box.w + gut}px`; }
        lineY[it.id] = it.top + 28;
      }
    }
  }
  function drawLines() {
    if (listMode() || !box.h) { lines.innerHTML = ''; return; }
    const k = box.h / 1523, sr = stin.getBoundingClientRect();
    const openId = view.open?.kind === 'part' ? view.open.id : null;
    let out = '';
    for (const id of FACE_ORDER[view.face]) {
      const p = PARTS[id];
      // A callout hidden behind an open card keeps no leader; the open part's leader runs to the card instead.
      if (id !== openId && callouts.classList.contains(`dim-${p.side}`)) continue;
      const el = calloutOf(id); if (!el) continue;
      const left = p.side === 'l';
      let x1, y;
      if (id === openId && card.classList.contains('on') && !compact()) {
        const r = card.getBoundingClientRect();
        x1 = left ? r.right - sr.left + 8 : r.left - sr.left - 8;
        y = clamp(lineY[id], r.top - sr.top + 30, r.bottom - sr.top - 30);
      } else {
        const r = el.getBoundingClientRect();
        x1 = left ? r.right - sr.left + 12 : r.left - sr.left - 12;
        y = lineY[id];
      }
      const ax = box.x + ANCHOR[id][0] * k, ay = box.y + ANCHOR[id][1] * k;
      const knee = left ? box.x - 18 : box.x + box.w + 18;
      const d = (left ? x1 < knee : x1 > knee) ? `M${x1} ${y}H${knee}L${ax} ${ay}` : `M${x1} ${y}L${ax} ${ay}`;
      const cls = id === openId ? 'on' : openId ? 'dim' : id === view.hover ? 'hl' : '';
      out += `<path class="halo2 ${cls}" d="${d}"/><path class="ln ${cls}" d="${d}"/><circle class="dot ${cls}" cx="${ax}" cy="${ay}" r="3.5"/>`;
    }
    lines.innerHTML = out;
  }
  // The part under the pointer, or whose callout it is on, lights on the drawing too.
  function setHoverMarks() {
    for (const o of mouseEl.querySelectorAll('.face [data-o]')) o.classList.toggle('hl', o.dataset.o === view.hover);
  }
  function outlines() {
    const id = view.open?.kind === 'part' ? view.open.id : null;
    for (const o of mouseEl.querySelectorAll('.face [data-o]')) o.classList.toggle('on', o.dataset.o === id);
  }

  /* ---------- The card: beside the mouse, on the side of the part ---------- */
  // levelAt(i): the level's control in the dock, so a level's card opens above it.
  function placeCard(levelAt) {
    const o = view.open;
    if (!o || compact()) {
      card.style.left = card.style.top = card.style.width = card.style.maxHeight = '';
      callouts.classList.remove('dim-l', 'dim-r');
      outlines();
      return;
    }
    const W = stin.clientWidth, A = ctx.area(), cw = Math.min(360, box.x - gut - 24);
    card.style.width = `${Math.max(300, cw)}px`;
    card.style.maxHeight = `${A.bottom - A.top - 24}px`;
    const w = card.offsetWidth, h = card.offsetHeight;
    let side = null;
    if (o.kind === 'part') {
      side = PARTS[o.id].side;
      card.style.left = `${side === 'l' ? Math.max(12, box.x - gut - w) : Math.min(W - w - 12, box.x + box.w + gut)}px`;
      card.style.top = `${clamp((lineY[o.id] ?? box.y) - 40, A.top + 12, A.bottom - h - 12)}px`;
    } else {
      // Above its level in the dock, but never over the mouse: it moves to the side the level is on.
      const m = levelAt?.(o.id), sr = stin.getBoundingClientRect();
      const mx = m ? m.getBoundingClientRect().left + m.offsetWidth / 2 - sr.left : W / 2;
      let x = clamp(mx - w / 2, 12, W - w - 12);
      if (x < box.x + box.w + 16 && x + w > box.x - 16) x = mx < W / 2 ? Math.max(12, box.x - gut - w) : Math.min(W - w - 12, box.x + box.w + gut);
      card.style.left = `${x}px`;
      card.style.top = `${A.bottom - h - 12}px`;
      side = x + w <= box.x ? 'l' : x >= box.x + box.w ? 'r' : null;
    }
    // The callouts on the card's side of the mouse step back while it is open.
    callouts.classList.toggle('dim-l', side === 'l');
    callouts.classList.toggle('dim-r', side === 'r');
    outlines();
  }

  /* ---------- Turning the mouse over: lift, turn, land ---------- */
  const texCache = { key: '', ready: null };
  let bakeTimer = 0;
  function scheduleBake(ms = 400) { clearTimeout(bakeTimer); bakeTimer = setTimeout(() => bake().catch(() => {}), ms); }
  function bake() {
    if (!turn || !box.h) return Promise.reject(new Error('no turn'));
    const shell = ctx.shell(), link = drawLink(ctx.link()), led = ctx.led();
    const key = [shell, link, led, Math.round(box.h)].join();
    if (texCache.key === key && texCache.ready) return texCache.ready;
    texCache.key = key;
    const unitsPerPx = 1523 / box.h, dpr = devicePixelRatio || 1;
    const th = Math.min(2600, Math.round(box.h * dpr * 1.3)), tw = Math.round(th * 760 / 1523);
    const top = X11.top(shell, { u: 'kt', unitsPerPx, w: tw, h: th, led });
    const under = X11.under(shell, link, { u: 'ku', unitsPerPx, w: tw, h: th });
    const sk = Math.min(1, th / 1523), side = X11.side(shell, { hc: TURN.hc, w: Math.round(1523 * sk), h: Math.round(940 * sk) });
    texCache.ready = Promise.all([turn.face(0, top), turn.face(1, under), turn.face(2, side)]).catch(err => { texCache.key = ''; throw err; });
    return texCache.ready;
  }
  function frame(angle, env, tilt = -0.085 * env) {
    const cw = parseFloat(turnCv.style.width), ch = parseFloat(turnCv.style.height);
    const scale = box.h / 1523, ox = (cw - box.w) / 2, oy = (ch - box.h) / 2;
    const base = parseInt(X11.SHELLS[ctx.shell()].base.slice(1), 16), wall = [base >> 16, (base >> 8) & 255, base & 255].map(v => v / 255);
    turn.draw({ res: [cw, ch], origin: [ox, oy], eye: [cw / 2, ch / 2], scale, inflate: env, angle, tilt, lift: 26 * env, d: 2600, wall });
    const c = Math.cos(angle) * Math.cos(tilt);
    stage.style.setProperty('--pool', Math.pow(Math.max(0, c), 1.6).toFixed(3));
    stage.style.setProperty('--halo', Math.pow(Math.max(0, -c), 1.6).toFixed(3));
    stage.style.setProperty('--lift', env.toFixed(3));
    shadow.style.scale = `${(0.98 + env * 0.06) * (0.55 + 0.45 * Math.abs(c))} 1`;
    spinOrbit(angle);
  }
  const canvasOn = on => { turnCv.classList.toggle('on', on); mouseEl.classList.toggle('out', on); };
  function settleFace(face) {
    view.face = face; stage.dataset.face = face;
    faceTop.hidden = face !== 'top'; faceUnder.hidden = face !== 'under';
    restPose();
  }
  function restPose() {
    const top = view.face === 'top';
    stage.style.setProperty('--pool', top ? 1 : 0); stage.style.setProperty('--halo', top ? 0 : 1); stage.style.setProperty('--lift', 0);
    shadow.style.scale = ''; spinOrbit(top ? 0 : Math.PI);
  }
  const done = () => { canvasOn(false); stage.classList.remove('turning'); view.turning = false; };
  async function flip(to = view.face === 'top' ? 'under' : 'top') {
    if (to === view.face || view.turning) return;
    endPeek(); hidePort(true); userTurned = true;
    view.open = null; view.hover = null;
    view.turning = true; stage.classList.add('turning');
    let ok = Boolean(turn) && !reduced();
    // Textures that take too long to draw (a busy or hidden window) must not leave it waiting: it cross-fades instead.
    if (ok) await Promise.race([bake(), wait(1500).then(() => Promise.reject(new Error('slow')))]).catch(() => { ok = false; });
    if (!ok) {
      faceEl(to).hidden = false; faceEl(to).style.opacity = 0;
      await frameAfter();
      faceEl(to).style.opacity = 1; faceEl(view.face).style.opacity = 0;
      await wait(160);
      faceEl(view.face).style.opacity = ''; faceEl(to).style.opacity = '';
      settleFace(to); stage.classList.remove('turning'); view.turning = false;
      return;
    }
    await animateTurn(to === 'under' ? 0 : Math.PI, to === 'under' ? Math.PI : 0, to);
  }
  // From angle a0 to a1; the lift runs up and back down. Resolves once settled.
  function animateTurn(a0, a1, to, T = 1080) {
    return new Promise(res => {
      frame(a0, 0); canvasOn(true);
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / T);
        const env = smooth(0, 0.24, p) * (1 - smooth(0.72, 1, p));
        frame(a0 + (a1 - a0) * easeInOut(clamp((p - 0.08) / 0.82, 0, 1)), env);
        if (p < 1) return requestAnimationFrame(step);
        settleFace(to);
        requestAnimationFrame(() => { done(); res(); });
      };
      requestAnimationFrame(step);
    });
  }

  // Looking round it by hand: drag the mouse any way. Across, it rolls all the way round, so you see its sides and
  // its underside; up and down it tips forward or back, so you see the front and the back. Let go and it settles on
  // the side facing you, carried on a little by a flick. Short moves stay clicks. A drag ends with a click on
  // whatever is under the pointer; that one is ignored, by time rather than a flag, because a browser doesn't always
  // send that click and a flag left set would eat the next real one.
  const TILT_MAX = 0.8;
  let drag = null, swallowUntil = 0;
  function onDown(e) {
    // It can be taken from anywhere on the desk, not only by its body; callouts, buttons and cards keep their clicks.
    if (e.target.closest('.callout, .card, button, a, input, select, textarea')) return;
    endPeek();
    if (view.testing || view.turning || !turn || reduced() || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, touch: e.pointerType === 'touch', base: view.face === 'top' ? 0 : Math.PI,
      angle: 0, tilt: 0, lx: e.clientX, va: 0, t: performance.now() };
    bake().catch(() => {});
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      // On a touch screen an upright drag scrolls the page, so there only a sideways one picks the mouse up.
      if (Math.hypot(dx, dy) < 8 || (drag.touch && Math.abs(dx) < Math.abs(dy))) return;
      drag.on = true; userTurned = true;
      hidePort(true); view.open = null; view.hover = null;
      view.turning = true; stage.classList.add('turning', 'held');
      canvasOn(true);
      try { mouseEl.setPointerCapture(e.pointerId); } catch { /* the pointer may already be gone */ }
    }
    const now = performance.now(), ka = Math.PI / (box.w * 1.5);
    drag.va = ((e.clientX - drag.lx) * ka) / Math.max(1, now - drag.t);
    drag.lx = e.clientX; drag.t = now;
    drag.angle = drag.base + dx * ka;
    // Tipping eases into a soft stop rather than hitting a wall.
    drag.tilt = TILT_MAX * Math.tanh(-dy / (box.h * 0.55) / TILT_MAX);
    frame(drag.angle, 1, drag.tilt);
  }
  function onUp(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.on) return;
    swallowUntil = performance.now() + 300;
    stage.classList.remove('held');
    const fresh = !cancelled && performance.now() - d.t < 80;
    const target = Math.round((d.angle + (fresh ? d.va * 140 : 0)) / Math.PI) * Math.PI;
    settleTo(d.angle, d.tilt, target, Math.abs(Math.round(target / Math.PI)) % 2 === 0 ? 'top' : 'under');
  }
  // From wherever it was let go to the nearest face, level, and back down flat on the desk.
  function settleTo(a, t0, target, to) {
    const start = performance.now(), T = 460 + 380 * Math.min(1, Math.abs(target - a) / Math.PI + Math.abs(t0));
    const step = now => {
      const p = Math.min(1, (now - start) / T), e = 1 - Math.pow(1 - p, 3);
      frame(a + (target - a) * e, 1 - smooth(0.5, 1, p), t0 * (1 - e));
      if (p < 1) return requestAnimationFrame(step);
      settleFace(to);
      requestAnimationFrame(done);
    };
    requestAnimationFrame(step);
  }
  const up = e => onUp(e, false), cancel = e => onUp(e, true);
  stin.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', cancel);
  const swallowed = () => performance.now() < swallowUntil;

  /* ---------- The ring round the tail: the mouse can be picked up and turned ----------
     Its dots move along it as the mouse rolls, as if it turned with it; near the front a dot is a 3 px pixel at full
     strength, at the back a fainter 2 px one, so the ring has depth. */
  const ring = { len: 0, tab: null, leds: null };
  function placeOrbit() {
    // Round the tail, where no leader runs: wider than the mouse by a little less than the gutter.
    const cx = box.x + box.w / 2, cy = box.y + box.h * 0.93, rx = box.w / 2 + Math.min(box.w * 0.16, gut - 6), ry = box.h * 0.1;
    const f = n => n.toFixed(1);
    const path = orbit.querySelector('.ring');
    path.setAttribute('d', `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}`);
    const len = path.getTotalLength();
    ring.len = len;
    // The ellipse is sampled once, with how near each point is (0 behind the mouse, 1 under the tail), so each frame
    // only looks its dots up.
    const M = 720;
    ring.tab = Array.from({ length: M }, (_, k) => { const p = path.getPointAtLength((len * k) / M); return { x: p.x, y: p.y, f: clamp((p.y - (cy - ry)) / (2 * ry), 0, 1) }; });
    const nl = Math.max(16, Math.round(len / 11 / 2) * 2), host = orbit.querySelector('.leds');
    if (!ring.leds || ring.leds.length !== nl) {
      host.innerHTML = Array.from({ length: nl }, (_, i) => `<rect class="led" style="--i:${i}"/>`).join('');
      host.style.setProperty('--n', nl);
      ring.leds = [...host.children];
    }
    // Its arrows are drawn in pixels, two pixels each: up, away from you, on the right; down, towards you, on the left.
    const px = (x, y, rows) => rows.map((row, r) => [...row].map((b, c) => (b === '1' ? `<rect x="${Math.round(x - 5 + c * 2)}" y="${Math.round(y - 3 + r * 2)}" width="2" height="2"/>` : '')).join('')).join('');
    orbit.querySelector('.chev').innerHTML = `<g class="cu">${px(cx + rx, cy, ['00100', '01010', '10001'])}</g><g class="cd">${px(cx - rx, cy, ['10001', '01010', '00100'])}</g>`;
    spinOrbit(view.face === 'top' ? 0 : Math.PI);
  }
  function spinOrbit(angle) {
    if (!ring.leds || !ring.tab) return;
    const L = ring.len, M = ring.tab.length, n = ring.leds.length, shift = (angle / (2 * Math.PI)) * L;
    ring.leds.forEach((r, i) => {
      let s = ((i * L) / n + shift) % L; if (s < 0) s += L;
      const p = ring.tab[Math.floor((s / L) * M) % M], d = p.f > 0.5 ? 3 : 2;
      r.setAttribute('x', Math.round(p.x - d / 2)); r.setAttribute('y', Math.round(p.y - d / 2));
      r.setAttribute('width', d); r.setAttribute('height', d);
      r.style.opacity = (0.28 + 0.72 * p.f).toFixed(2);
    });
  }

  /* ---------- An invitation: now and then, while nobody is using it, the mouse rocks to show it can be turned ----------
     Five seconds after the page goes quiet, then every twenty, three times at most, and never again once it has been
     turned by hand. Not while the pointer is on it, a card, drawer or sheet is open, in Test, or with reduced motion.
     Any touch, key or scroll while it moves sends it straight back. */
  let userTurned = false, quietSince = performance.now();
  const peek = { n: 0, last: 0, on: false, back: false };
  const canPeek = () => Boolean(turn) && box.h > 0 && !reduced() && !userTurned && !peek.on && !view.testing && !view.turning && !view.open && !view.hover
    && !view.drawer && !view.welcome && !drag && !document.hidden && !mouseEl.matches(':hover') && !hold.on;
  const quiet = () => { quietSince = performance.now(); if (peek.on) peek.back = true; };
  const QUIET = ['pointermove', 'pointerdown', 'keydown', 'wheel'];
  for (const ev of QUIET) addEventListener(ev, quiet, { capture: true, passive: true });
  const peekTimer = setInterval(() => {
    if (userTurned || peek.n >= 3) return;
    const now = performance.now();
    if (now - quietSince > 5000 && (!peek.n || now - peek.last > 20000) && canPeek()) bake().then(() => canPeek() && rock(), () => {});
  }, 1000);
  // It rises a little, rolls a third of the way onto its side, swings back past level, and settles.
  function rock() {
    peek.n++; peek.last = performance.now(); peek.on = true; peek.back = false;
    const base = view.face === 'top' ? 0 : Math.PI, t0 = performance.now();
    stage.classList.add('peeking');
    frame(base, 0, 0); canvasOn(true);
    let cur = { a: base, e: 0, t: 0 }, back = null;
    const step = now => {
      if (!peek.on) return;
      if (peek.back && !back) back = { at: now, ...cur };
      let p;
      if (back) {
        // Sent back: home in a quarter of a second from wherever it was.
        p = Math.min(1, (now - back.at) / 260);
        const e = 1 - Math.pow(1 - p, 3);
        frame(back.a + (base - back.a) * e, back.e * (1 - e), back.t * (1 - e));
      } else {
        p = Math.min(1, (now - t0) / 2000);
        const env = 0.6 * smooth(0, 0.22, p) * (1 - smooth(0.7, 1, p));
        const roll = 0.62 * Math.sin(Math.PI * smooth(0.04, 0.62, p)) - 0.14 * Math.sin(Math.PI * smooth(0.52, 0.96, p));
        cur = { a: base + roll, e: env, t: -0.085 * env - 0.1 * Math.sin(Math.PI * smooth(0.04, 0.9, p)) };
        frame(cur.a, cur.e, cur.t);
      }
      if (p < 1) return requestAnimationFrame(step);
      requestAnimationFrame(endPeek);
    };
    requestAnimationFrame(step);
  }
  // Puts it down at once, exactly as the page draws it.
  function endPeek() {
    if (!peek.on) return;
    peek.on = false;
    canvasOn(false); stage.classList.remove('peeking');
    restPose();
  }

  /* ---------- The port: in the front wall, which neither flat view shows ----------
     Opening its card tips the mouse forward until the front faces you, with the port in it, and holds it there;
     closing the card, or opening another, sets it back down. */
  const hold = { on: false, a: 0, e: 0, t: 0, raf: 0 };
  function poseTo(to, T, then) {
    cancelAnimationFrame(hold.raf);
    const from = { a: hold.a, e: hold.e, t: hold.t }, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / T), k = easeInOut(p);
      hold.a = from.a + (to.a - from.a) * k; hold.e = from.e + (to.e - from.e) * k; hold.t = from.t + (to.t - from.t) * k;
      frame(hold.a, hold.e, hold.t);
      if (p < 1) hold.raf = requestAnimationFrame(step); else then?.();
    };
    hold.raf = requestAnimationFrame(step);
  }
  function showPort() {
    if (!turn || reduced() || view.testing || view.turning) return;
    bake().then(() => {
      if (view.open?.id !== 'usbc' || view.turning || view.testing) return;
      const base = view.face === 'top' ? 0 : Math.PI;
      if (!hold.on) {
        endPeek();
        Object.assign(hold, { on: true, a: base, e: 0, t: 0 });
        stage.classList.add('peeking'); frame(base, 0, 0); canvasOn(true);
      }
      poseTo({ a: base, e: 1, t: -0.62 }, 700);
    }, () => {});
  }
  function hidePort(now) {
    if (!hold.on) return;
    const finish = () => { cancelAnimationFrame(hold.raf); hold.on = false; canvasOn(false); stage.classList.remove('peeking'); restPose(); };
    if (now) return finish();
    poseTo({ a: view.face === 'top' ? 0 : Math.PI, e: 0, t: 0 }, 560, () => requestAnimationFrame(finish));
  }

  /* ---------- The drawing answers the mouse ---------- */
  // A button on the underside goes down and leaves a ring, as when the mouse reports it was pressed.
  function pressPart(part) {
    faceUnder.querySelectorAll(`.part[data-part="${part}"]`).forEach(g => {
      g.classList.add('down'); setTimeout(() => g.classList.remove('down'), 170);
      const r = g.querySelector('.ring');
      if (r && !reduced()) { r.classList.remove('ping'); void r.getBoundingClientRect(); r.classList.add('ping'); }
    });
  }
  function flashLed() {
    const chip = faceTop.querySelector('.led-chip'); if (!chip) return;
    chip.classList.remove('flash'); void chip.getBoundingClientRect(); chip.classList.add('flash');
  }
  // One of the three lights under the mouse, for a moment: 2.4G red, Bluetooth green.
  let cueTimer = 0;
  function cueLight(which, ms = 2200) {
    faceUnder.removeAttribute('data-cue'); void faceUnder.offsetWidth;
    if (which) faceUnder.dataset.cue = which;
    clearTimeout(cueTimer); cueTimer = setTimeout(() => faceUnder.removeAttribute('data-cue'), ms);
  }
  // The connection changed: the power switch's knob slides to its stop and the light of the new mode comes on.
  // Nothing is redrawn, so the knob moves rather than jumps.
  function setLink(kind) {
    const link = drawLink(kind), knob = faceUnder.querySelector('.knob');
    if (knob) knob.style.transform = `translateY(${KNOB_Y[link]}px)`;
    cueLight(link === 'dongle' ? 'g24' : link === 'ble' ? 'bt1' : null);
    scheduleBake();
  }
  function playPattern(p) { if (p) faceUnder.dataset.pattern = p; else faceUnder.removeAttribute('data-pattern'); }

  function destroy() {
    clearInterval(peekTimer); clearTimeout(bakeTimer); clearTimeout(cueTimer); clearTimeout(wipe); cancelAnimationFrame(hold.raf);
    stin.removeEventListener('pointerdown', onDown);
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel);
    for (const ev of QUIET) removeEventListener(ev, quiet, { capture: true });
  }

  return {
    drawFaces, setShell, layout, placeCallouts, drawLines, placeCard, setHoverMarks, outlines, scheduleBake, flip, endPeek,
    showPort, hidePort, pressPart, flashLed, cueLight, setLink, playPattern, swallowed, destroy,
    get box() { return box; },
  };
}
