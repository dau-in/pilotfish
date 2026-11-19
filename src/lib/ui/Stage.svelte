<script>
  import { onMount, tick, untrack } from 'svelte';
  import { mouse } from '../device/mouse.svelte.js';
  import { i18n, t } from '../i18n/index.svelte.js';
  import Card from './Card.svelte';
  import Icon from './Icon.svelte';
  import { lab, start as startLab, stop as stopLab } from './lab.svelte.js';
  import { prefs } from './prefs.svelte.js';
  import { changedPart, plain, says } from './says.js';
  import { createStage } from './stage/engine.js';
  import { studio } from './studio.svelte.js';
  import { FACE_ORDER, PARTS, compact, openPart, view } from './view.svelte.js';

  let { ready, light, led } = $props();

  let stage = $state(), stin = $state(), mouseEl = $state(), faceTop = $state(), faceUnder = $state(), turnCv = $state();
  let lines = $state(), callouts = $state(), card = $state(), shadow = $state(), halo = $state(), pool = $state(), orbit = $state(), turnbtn = $state(), trail = $state();
  let engine = $state(null);

  const d = $derived(ready ? studio.draft : null);
  const p = $derived(ready ? mouse.profile : null);

  // In Test the callouts on top turn into counters; a third line appears only when something is wrong.
  const BTN_OF = { left: 0, right: 2, back: 3, forward: 4 };
  function testSays(id) {
    if (id in BTN_OF) {
      const b = lab.btn[BTN_OF[id]], presses = id === 'back' || id === 'forward';
      return { n: b.n, u: t(presses ? 'lab.presses' : 'lab.clicks', { n: b.n }), bad: b.faults.length && t('lab.doubles', { n: b.faults.length, ms: b.faults.at(-1) }) };
    }
    if (id === 'wheel') return { up: lab.wheel.up, down: lab.wheel.down, bad: lab.wheel.jumps && t('lab.jumps', { n: lab.wheel.jumps }) };
    if (id === 'led') return { n: d.levels[d.activeLevel - 1].dpi, u: 'DPI' };
    return null;
  }
  const label = id => t(`part.${id}`);

  /* ---------- The engine ---------- */
  const area = () => {
    const H = stin.clientHeight;
    if (compact()) return { top: 0, bottom: H };
    return { top: document.querySelector('.top')?.offsetHeight ?? 64, bottom: H - view.dock - 16 };
  };
  onMount(() => {
    engine = createStage({ stage, stin, mouse: mouseEl, faceTop, faceUnder, turnCv, lines, callouts, card, shadow, halo, pool, orbit, turnbtn }, {
      shell: () => prefs.shell, link: () => mouse.kind, led: () => led, area, label: f => t(f === 'top' ? 'render.top' : 'render.under'),
    });
    engine.drawFaces();
    engine.layout();
    const ro = new ResizeObserver(() => engine.layout());
    ro.observe(stin);
    document.fonts?.ready.then(() => engine?.layout());
    return () => { ro.disconnect(); engine.destroy(); stopLab(); };
  });

  $effect(() => { view.dock; ready; if (engine) untrack(() => engine.layout()); });
  // A new shell is wiped on; a new language relabels the drawing.
  let lastShell = prefs.shell;
  $effect(() => {
    const s = prefs.shell;
    if (!engine || s === lastShell) return;
    untrack(() => engine.setShell(lastShell));
    lastShell = s;
  });
  $effect(() => { i18n.lang; if (engine) untrack(() => engine.drawFaces()); });
  // The 3D textures carry the LED: they are redrawn when it changes.
  $effect(() => { led; engine?.scheduleBake(); });

  // The connection changed: the switch's knob slides to its stop and the mode's light comes on.
  let lastKind = null;
  $effect(() => {
    const k = mouse.kind;
    if (engine && k && lastKind && k !== lastKind) untrack(() => engine.setLink(k));
    if (k) lastKind = k;
  });
  // The DPI switch underneath was pressed: the mouse changed level on its own and said so.
  let lastLevel = null;
  $effect(() => {
    const lv = mouse.profile?.activeLevel ?? null;
    if (engine && lv && lastLevel && lv !== lastLevel && !untrack(() => studio.busy)) untrack(() => { engine.pressPart('dpi'); engine.flashLed(); });
    lastLevel = lv;
  });

  // Callouts, leaders and the card are placed again whenever what they say changes size or place.
  $effect(() => {
    if (!engine) return;
    // Everything the placement depends on.
    view.face; view.open; view.testing; ready; i18n.lang;
    if (d) { JSON.stringify(d); }
    if (view.testing) { JSON.stringify(lab.btn); lab.wheel.up; lab.wheel.down; }
    tick().then(() => { engine.placeCallouts(); engine.placeCard(i => document.querySelector(`.band [data-lv="${i}"]`)); engine.drawLines(); });
  });
  $effect(() => { view.hover; if (engine) untrack(() => { engine.setHoverMarks(); engine.drawLines(); }); });
  // Opening the USB-C port's card tips the mouse forward to show it.
  $effect(() => {
    const id = view.open?.kind === 'part' ? view.open.id : null;
    if (!engine) return;
    untrack(() => (id === 'usbc' ? engine.showPort() : engine.hidePort()));
  });
  // The Mode switch's light guide, played on the drawing; gone when its card closes.
  $effect(() => { if (view.open?.id !== 'pair') engine?.playPattern(null); });

  // Test: into the lab from the underside, the mouse turns over while the lab comes in.
  $effect(() => {
    if (!engine) return;
    if (view.testing) {
      untrack(() => {
        if (view.face !== 'top') engine.flip('top');
        startLab({ stin, faceTop: () => faceTop, strip: () => document.querySelector('#strip'), trail: () => trail,
          color: () => d?.levels[d.activeLevel - 1].color ?? '#ff0000', ms: n => t('lab.ms', { n }) });
      });
    } else stopLab();
  });

  /* ---------- Pointer and keyboard ---------- */
  const partAt = target => target.closest('[data-part]')?.dataset.part ?? target.closest('[data-callout]')?.dataset.callout ?? null;
  function onClick(e) {
    if (!ready || engine?.swallowed() || view.testing || view.turning) return;
    const id = partAt(e.target);
    if (id) openPart(id);
  }
  function onHover(e) {
    if (!ready || view.testing || view.turning || compact()) return;
    const id = partAt(e.target);
    if (id !== view.hover) view.hover = id;
  }
  onMount(() => {
    const onKey = e => {
      if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (view.testing || view.drawer || view.welcome || document.activeElement?.matches('input, textarea, select')) return;
      e.preventDefault();
      engine?.flip();
    };
    // On a desktop a click anywhere else closes the card.
    const onDown = e => {
      if (view.open && !compact() && !e.target.closest('.card, [data-part], [data-callout], [data-lv], .dm, .slot, .pop, .drawer')) view.open = null;
    };
    addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  });
</script>

{#snippet value(c)}
  {#if c.n != null}<span class="dot">{c.n}</span> {c.u}{:else}{c.v}{/if}
{/snippet}

<main class="stage" bind:this={stage} data-light={light} data-face="top">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (each part has its callout, a button) -->
  <div class="stage-in" bind:this={stin} onclick={onClick} onpointermove={onHover} onpointerleave={() => (view.hover = null)}>
    <div class="desk"></div>
    <div class="labgrid" aria-hidden="true"></div>
    <div class="glow"><div class="pool" bind:this={pool}></div><div class="halo" bind:this={halo}></div></div>
    <div class="shadow" bind:this={shadow}></div>
    <!-- A ring round the mouse's tail, passing behind it: the mouse can be picked up and turned. -->
    <svg class="orbit" bind:this={orbit} aria-hidden="true"><path class="ring" /><g class="leds"></g><g class="chev"></g></svg>
    <div class="mouse" bind:this={mouseEl}><div class="face" bind:this={faceTop}></div><div class="face" bind:this={faceUnder} hidden></div></div>
    <canvas class="turncv" bind:this={turnCv} aria-hidden="true"></canvas>
    <svg class="lines" bind:this={lines} aria-hidden="true"></svg>
    <div class="callouts" bind:this={callouts}>
      {#if d}
        {#each FACE_ORDER[view.face] as id, i (id)}
          {@const c = says(id, d)}
          {@const tst = view.face === 'top' && view.testing ? testSays(id) : null}
          <button class="callout {PARTS[id].side}" class:hl={view.hover === id} type="button" data-callout={id} style:--i={i}
            aria-label={t('callout.aria', { part: label(id), does: plain(c) })} onfocus={() => (view.hover = id)} onblur={() => (view.hover = null)}>
            <span class="face2 cfg">
              <small>{label(id)}</small>
              <span class="v disp">{#if changedPart(id, d, p)}<i class="mod" title={t('mod.title')}></i>{/if}{@render value(c)}</span>
            </span>
            {#if view.face === 'top'}
              <span class="face2 tst">
                <small>{label(id)}</small>
                {#if tst?.up != null}
                  <span class="v disp">↑<span class="dot">{tst.up}</span>&ensp;↓<span class="dot">{tst.down}</span></span>
                {:else if tst}
                  <span class="v disp">{@render value(tst)}</span>
                {/if}
                {#if tst?.bad}<span class="sub bad">{tst.bad}</span>{/if}
              </span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
    <button class="turnbtn" type="button" bind:this={turnbtn} title={t('turn.title')} aria-label={t(view.face === 'top' ? 'turn.toUnder' : 'turn.toTop')} onclick={() => engine?.flip()}><Icon name="reload" /></button>
    <canvas class="trail" bind:this={trail}></canvas>
  </div>
  <Card bind:el={card} {engine} />
</main>
