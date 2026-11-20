<script>
  // The dock: the six DPI levels, as faders or a dial (the user's choice), the level in use on a display of dots,
  // and in Test the click log. Without a mouse it asks for one.
  import { untrack } from 'svelte';
  import { connectBluetooth, connectUsb, mouse, support } from '../device/mouse.svelte.js';
  import { errorText, fmt, t } from '../i18n/index.svelte.js';
  import { DPI_MAX, DPI_MIN } from '../protocol/index.js';
  import { ROWS, faults, lab } from './lab.svelte.js';
  import { prefs } from './prefs.svelte.js';
  import { NATIVE_MAX, snapDpi, stepDpi } from './shared.js';
  import { studio } from './studio.svelte.js';
  import { openLevel, reduced, view } from './view.svelte.js';

  let { ready } = $props();

  const d = $derived(ready ? studio.draft : null);
  const p = $derived(mouse.profile);
  const active = $derived(d ? d.activeLevel - 1 : 0);
  const next = $derived((active + 1) % 6);
  const sel = $derived(view.open?.kind === 'level' ? view.open.id : -1);

  // Both views use one range, 100 to 22,000, on a log scale.
  const R0 = 2, R1 = Math.log10(DPI_MAX);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const posR = dpi => clamp((Math.log10(Math.max(100, dpi)) - R0) / (R1 - R0), 0, 1);
  const dpiR = f => snapDpi(10 ** (R0 + clamp(f, 0, 1) * (R1 - R0)));

  /* ---------- The level in use on a display of dots ----------
     Five cells of 5 by 7 dots, read from the dot face's own figures, on a 4 px grid with 3 px dots, so every dot is
     whole pixels. */
  const MATRIX = { 0: ['00100', '01010', '10001', '10001', '10001', '01010', '00100'], 1: ['00100', '01100', '10100', '00100', '00100', '00100', '11111'],
    2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11111', '00001', '00010', '00110', '00001', '10001', '01110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '10110', '11001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '10110', '11001', '10001', '01110'], 7: ['11111', '00001', '00010', '00010', '00100', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10011', '01101', '00001', '00010', '01100'] };
  const P = 4, D = 3, CELLS = 5, COLS = CELLS * 6, MW = COLS * P - (P - D), MH = 7 * P - (P - D);
  const DOTS = [];
  for (let col = 0; col < COLS; col++) for (let r = 0; r < 7; r++) DOTS.push({ col, r, k: Math.floor(col / 6), c: col % 6 });
  const dpiNow = $derived(d ? d.levels[active].dpi : 0);
  const lit = $derived.by(() => {
    const text = String(Math.round(dpiNow)).padStart(CELLS, ' ');
    return DOTS.map(x => { const bm = MATRIX[text[x.k]]; return Boolean(bm && x.c < 5 && bm[x.r][x.c] === '1'); });
  });

  /* ---------- The dial ---------- */
  // Angles in degrees, counterclockwise from the right; the arc runs from lower left (210) to lower right (-30).
  const ang = dpi => 210 - posR(dpi) * 240;
  const pt = (a, r) => { const th = (a * Math.PI) / 180; return [120 + r * Math.cos(th), 104 - r * Math.sin(th)]; };
  const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${Math.abs(a0 - a1) > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const TICKS = [];
  for (const dec of [100, 1000, 10000]) for (let k = 1; k <= 9; k++) {
    const v = dec * k; if (v > DPI_MAX) break;
    const a = ang(v), major = k === 1, [x0, y0] = pt(a, major ? 70 : 74), [x1, y1] = pt(a, 79), [tx, ty] = pt(a, 58);
    TICKS.push({ x0, y0, x1, y1, major, tx, ty: ty + 3.5, label: v >= 1000 ? `${v / 1000}k` : String(v) });
  }

  // The separators' rulers: the levels' own scale, a tick every hundred up to a thousand and every thousand after.
  const RULER = [];
  for (const dec of [100, 1000, 10000]) for (let k = 1; k <= 9; k++) { const v = dec * k; if (v > DPI_MAX) break; RULER.push({ p: posR(v), mj: k === 1 }); }

  /* ---------- Switching view: its entrance plays; the first one simply appears ---------- */
  let inst = $state(), entering = $state(false), lastView = prefs.dpiView, enterTimer = 0;
  $effect(() => {
    const v = prefs.dpiView;
    if (v === lastView) return;
    lastView = v;
    if (reduced()) return;
    entering = true; clearTimeout(enterTimer); enterTimer = setTimeout(() => (entering = false), 1700);
  });

  /* ---------- A press of the DPI switch: a light travels from the old level to the new one ---------- */
  let lastLevel = null;
  $effect(() => {
    const lv = mouse.profile?.activeLevel ?? null;
    if (lv && lastLevel && lv !== lastLevel && !untrack(() => studio.busy) && prefs.dpiView === 'faders') untrack(() => travel(lastLevel - 1, lv - 1));
    lastLevel = lv;
  });
  function travel(from, to) {
    if (reduced() || !inst) return;
    const host = inst.querySelector('.fdr'), h = i => inst.querySelector(`.fader[data-lv="${i}"] .fhandle`);
    if (!host || !h(from) || !h(to)) return;
    const centre = el => { const a = host.getBoundingClientRect(), r = el.getBoundingClientRect(); return [r.left + r.width / 2 - a.left, r.top + r.height / 2 - a.top]; };
    const [x0, y0] = centre(h(from)), [x1, y1] = centre(h(to)), lift = to === 0 ? 40 : 30;
    const b = document.createElement('i'); b.className = 'bead2'; host.append(b);
    const t0 = performance.now();
    const step = now => {
      const f = Math.min(1, (now - t0) / 620), e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
      b.style.translate = `${x0 + (x1 - x0) * e}px ${y0 + (y1 - y0) * e - Math.sin(Math.PI * e) * lift}px`;
      b.style.opacity = f < 0.08 ? f / 0.08 : f > 0.9 ? (1 - f) / 0.1 : 1;
      if (f < 1) requestAnimationFrame(step); else b.remove();
    };
    requestAnimationFrame(step);
  }

  /* ---------- One gesture for both views: press a level to open its card, move to change it ---------- */
  let dragging = $state(-1);
  function down(e, i, onMark = false) {
    if (e.button > 0) return;
    e.preventDefault();
    const el = e.currentTarget.closest('[data-lv]') ?? inst.querySelector(`.drow[data-lv="${i}"]`);
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer may already be gone */ }
    el?.focus({ preventScroll: true });
    const target = e.currentTarget;
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
      moved = true; dragging = i;
      const v = valueAt(ev, i, onMark);
      if (v != null) d.levels[i].dpi = v;
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      dragging = -1;
      if (!moved) openLevel(i);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up, { once: true });
    target.addEventListener('pointercancel', up, { once: true });
  }
  function valueAt(ev, i, onMark) {
    if (prefs.dpiView === 'faders') {
      // The range runs between the track's insets, as the handles are drawn.
      const r = inst.querySelector(`.fader[data-lv="${i}"] .ftrack`).getBoundingClientRect(), ti = 6;
      return dpiR(1 - (ev.clientY - r.top - ti) / (r.height - 2 * ti));
    }
    // The dial: the pointer's angle from the hub is the value; only a mark on the arc can be dragged.
    if (!onMark) return null;
    const r = inst.querySelector('.dsvg').getBoundingClientRect(), k = r.width / 240;
    let a = (Math.atan2(-(ev.clientY - r.top - 104 * k), ev.clientX - r.left - 120 * k) * 180) / Math.PI;
    if (a < -90) a += 360;
    return dpiR((210 - clamp(a, -30, 210)) / 240);
  }
  function key(e, i) {
    const l = d.levels[i];
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (dir) { e.preventDefault(); for (let n = e.shiftKey ? 10 : 1; n > 0; n--) l.dpi = stepDpi(l.dpi, dir); }
    else if (e.key === 'Home') { e.preventDefault(); l.dpi = DPI_MIN; }
    else if (e.key === 'End') { e.preventDefault(); l.dpi = DPI_MAX; }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLevel(i); }
  }
  // Scrolling on a level nudges it a step at a time; the page doesn't scroll from under the pointer.
  let wheelAt = 0;
  function wheel(e, i) {
    if (!e.deltaY) return;
    e.preventDefault();
    const now = performance.now(); if (now - wheelAt < 40) return; wheelAt = now;
    d.levels[i].dpi = stepDpi(d.levels[i].dpi, e.deltaY < 0 ? 1 : -1);
  }
  function wheelable(node, i) {
    const h = e => wheel(e, i);
    node.addEventListener('wheel', h, { passive: false });
    return { destroy: () => node.removeEventListener('wheel', h) };
  }
  const lvState = i => ({ active: i === active, next: i === next, sel: i === sel, chg: d.levels[i].dpi !== p.levels[i].dpi || d.levels[i].color !== p.levels[i].color, drag: i === dragging });
  const aria = (i, l) => ({ role: 'slider', 'aria-label': t('dpi.level', { n: i + 1 }), 'aria-valuemin': DPI_MIN, 'aria-valuemax': DPI_MAX, 'aria-valuenow': l.dpi,
    'aria-valuetext': t('band.valuetext', { n: i + 1, dpi: fmt(l.dpi), inUse: i === active }) });

  /* ---------- Not connected ---------- */
  let busy = $state(false), error = $state(null);
  async function go(connect) {
    busy = true; error = null;
    try { await connect(); } catch (err) {
      // Closing the browser's chooser is not an error worth showing.
      if (err.name !== 'NotFoundError') error = err;
    } finally { busy = false; }
  }
  const unsupported = !support.hid && !support.bluetooth;
</script>

{#if !ready}
  <section class="band connect" bind:offsetHeight={view.dock} aria-label={t('connect.aria')}>
    <div class="bleft"><div><h2 class="disp">{t('connect.title')}</h2><p class="sub">{unsupported ? t('welcome.unsupported') : t('connect.lede')}</p></div></div>
    {#if !unsupported}
      <div class="acts">
        <button class="btn go" type="button" disabled={busy || !support.hid || mouse.status === 'connecting'} onclick={() => go(connectUsb)}>{t('welcome.cableButton')}</button>
        <button class="btn" type="button" disabled={busy || !support.bluetooth || mouse.status === 'connecting'} title={t('welcome.btBody')} onclick={() => go(connectBluetooth)}>{t('welcome.btButton')}</button>
      </div>
    {/if}
    {#if mouse.status === 'connecting'}<p class="state">{t(mouse.asleep ? 'welcome.asleep' : 'welcome.reading')}</p>
    {:else if error || mouse.error}<p class="state err">{t('welcome.failed', { msg: errorText(error ?? mouse.error) })}</p>
    {:else}<p class="state">{t('welcome.safety')}</p>{/if}
  </section>
{:else}
  <section class="band" bind:offsetHeight={view.dock} data-dpi={prefs.dpiView} aria-label={t('band.aria')} style:--a={posR(dpiNow).toFixed(4)}>
    <div class="bleft cfg">
      <div><h2 class="disp">{t('band.title')}</h2><p class="sr">{t(`band.sub.${prefs.dpiView}`)}</p></div>
      <div class="readout">
        <span class="dmxw"><svg class="dmx" role="img" width={MW} height={MH} viewBox="0 0 {MW} {MH}" shape-rendering="crispEdges" aria-label="{fmt(dpiNow)} DPI">
          {#each DOTS as x, k (k)}<rect x={x.col * P} y={x.r * P} width={D} height={D} style:--c={x.col} class:on={lit[k]} />{/each}
        </svg><span class="du">DPI</span></span>
        <small>{t('dpi.levelInUse', { n: active + 1 })}</small>
      </div>
    </div>

    <div class="inst cfg" class:enter={entering} class:dragging={dragging >= 0} bind:this={inst}>
      {#if prefs.dpiView === 'faders'}
        <div class="fdr" style:--lim={posR(NATIVE_MAX).toFixed(4)}>
          <div class="fgrid" aria-hidden="true">
            <i class="fg" style:--g={posR(1000)}><span class="dot s10">1000</span></i>
            <i class="fg lim" style:--g={posR(NATIVE_MAX)} title={t('band.limitTitle')}><span class="dot s10">{NATIVE_MAX}</span></i>
          </div>
          {#each d.levels as l, i (i)}
            {@const s = lvState(i)}
            <button class="fader" class:active={s.active} class:next={s.next} class:sel={s.sel} class:chg={s.chg} class:drag={s.drag} type="button" data-lv={i}
              style:--n={i} style:--c={l.color} style:--f={posR(l.dpi).toFixed(4)} {...aria(i, l)}
              onpointerdown={e => down(e, i)} onkeydown={e => key(e, i)} use:wheelable={i}>
              <span class="fv dot">{l.dpi}</span><span class="ftrack"><i class="ffill"></i><i class="fghost" class:on={s.chg} class:writing={s.chg && studio.busy} style:--g={posR(p.levels[i].dpi).toFixed(4)}></i><i class="fhandle"></i></span><span class="fn">{i + 1}</span>
            </button>
          {/each}
        </div>
        <!-- On a desktop, the dock's right-hand column: what the hatching and the dot mean. -->
        <div class="fkey">
          <span class="krow"><i class="kh"></i><span><b>{t('band.above')}</b><small>{t('band.aboveNote')}</small></span></span>
          <span class="krow"><i class="kd"></i><span><b>{t('band.next')}</b><small>{t('band.nextNote', { n: next + 1, dpi: fmt(d.levels[next].dpi) })}</small></span></span>
        </div>
      {:else}
        {@const aa = ang(d.levels[active].dpi)}
        {@const [nx, ny] = pt(ang(d.levels[next].dpi), 95)}
        <div class="dial">
          <svg class="dsvg" viewBox="0 0 240 150" aria-hidden="true">
            <path class="dtrack" d={arc(210, -30, 84)} /><path class="dfill" d={aa < 209.5 ? arc(210, aa, 84) : ''} /><path class="dlim" d={arc(ang(NATIVE_MAX), -30, 84)} />
            <circle class="dnext" r="2.6" cx={nx.toFixed(1)} cy={ny.toFixed(1)} />
            {#each TICKS as k, j (j)}
              <line class="dt" class:major={k.major} x1={k.x0.toFixed(1)} y1={k.y0.toFixed(1)} x2={k.x1.toFixed(1)} y2={k.y1.toFixed(1)} />
              {#if k.major}<text class="dl fig" x={k.tx.toFixed(1)} y={k.ty.toFixed(1)} text-anchor="middle">{k.label}</text>{/if}
            {/each}
            <g class="needle" style:rotate="{(90 - aa).toFixed(2)}deg"><path d="M120 104L120 36" /><circle cx="120" cy="104" r="7" /></g>
            <!-- Where the mouse has a level edited here: an outline on the arc, as the faders' ghost. -->
            {#each d.levels as l, i (i)}
              {@const s = lvState(i)}
              <g class="dghost" class:on={s.chg} class:writing={s.chg && studio.busy} style:rotate="{(90 - ang(p.levels[i].dpi)).toFixed(2)}deg"><rect x="111" y="16.5" width="18" height="7" rx="1.5" /></g>
            {/each}
            {#each d.levels as l, i (i)}
              {@const a = ang(l.dpi)}
              {@const [x, y] = pt(a, 84)}
              <!-- svelte-ignore a11y_no_static_element_interactions (the legend's buttons are the controls) -->
              <g class="dm" class:active={i === active} class:sel={i === sel} style:--n={i} style:--c={l.color} transform="translate({x.toFixed(1)} {y.toFixed(1)}) rotate({(90 - a).toFixed(1)})"
                onpointerdown={e => down(e, i, true)}><rect x="-9" y="-3.5" width="18" height="7" rx="1.5" /></g>
            {/each}
          </svg>
          <div class="dlegend">
            {#each d.levels as l, i (i)}
              {@const s = lvState(i)}
              <button class="drow" class:active={s.active} class:next={s.next} class:sel={s.sel} class:chg={s.chg} type="button" data-lv={i} style:--n={i} style:--c={l.color} {...aria(i, l)}
                onpointerdown={e => down(e, i)} onkeydown={e => key(e, i)} use:wheelable={i}>
                <i class="pill"></i><span class="dv dot">{l.dpi}</span><small>{i + 1}{#if s.next}<span class="nx">{t('band.nextShort')}</span>{/if}</small>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    <i class="bsep s1" aria-hidden="true"><span class="sc">{#each RULER as r, k (k)}<i class:mj={r.mj} style:--p={r.p.toFixed(4)}></i>{/each}<i class="lim" style:--p={posR(NATIVE_MAX).toFixed(4)}></i><i class="mj" style:--p="1"></i><b class="now"></b></span></i>
    <i class="bsep s2" aria-hidden="true"><span class="sc">{#each RULER as r, k (k)}<i class:mj={r.mj} style:--p={r.p.toFixed(4)}></i>{/each}<i class="lim" style:--p={posR(NATIVE_MAX).toFixed(4)}></i><i class="mj" style:--p="1"></i><b class="now"></b></span></i>

    <div class="bleft tst">
      <div><h2 class="disp">{t('lab.log')}</h2><p class="sub">{t('lab.logNote')}</p></div>
      <div class="tmeters">
        <div><b class="dot">{lab.cps}</b><small>{t('lab.perSecond')}</small></div>
        <div><b class="dot">{lab.best}</b><small>{t('lab.best')}</small></div>
        <div class:bad={faults()}><b class="dot">{faults()}</b><small>{t('lab.faults', { n: faults() })}</small></div>
        <div title={t(lab.hz ? 'lab.hzTitle' : 'lab.hzHint')}><b class="dot">{lab.hz}</b><small>{t('lab.hz')}</small></div>
      </div>
    </div>
    <div class="tst logwrap">
      <div class="labels">{#each ROWS as r (r)}<span>{t(`lab.row.${r}`)}</span>{/each}</div>
      <canvas id="strip"></canvas>
      <div class="axis2"><span>{t('lab.ago')}</span><span>{t('lab.now')}</span></div>
    </div>
  </section>
{/if}
