<script>
  // A ruler under a fixed needle: drag it, scroll it or use the arrow keys (Shift for steps of 500).
  import { t } from '../i18n/index.svelte.js';
  import { dpiStep, fmt } from './shared.js';

  let { value, onchange } = $props();

  const PX_PER_STEP = 8; // pixels per 50 dpi
  const H = 72;
  let w = $state(0);
  let drag = null;

  const ticks = $derived.by(() => {
    const mid = w / 2, span = Math.ceil(mid / PX_PER_STEP) + 2, base = Math.round(value / 50);
    const out = [];
    for (let k = base - span; k <= base + span; k++) {
      const dpi = k * 50;
      if (dpi < 50 || dpi > 22000) continue;
      out.push({ dpi, x: mid + ((dpi - value) / 50) * PX_PER_STEP, major: dpi % 500 === 0, label: dpi % 1000 === 0 });
    }
    return out;
  });

  const nudge = (dir, big) => onchange(value + dir * (big ? 500 : dpiStep(value)));

  function down(e) { e.currentTarget.setPointerCapture(e.pointerId); drag = { x: e.clientX, start: value }; }
  function move(e) { if (drag) onchange(drag.start - ((e.clientX - drag.x) / PX_PER_STEP) * 50); }
  // Svelte registers wheel listeners as passive; the ruler must stop the page from scrolling, so it adds its own.
  function wheelable(node) {
    const wheel = e => { e.preventDefault(); nudge(Math.sign(e.deltaY || e.deltaX), e.shiftKey); };
    node.addEventListener('wheel', wheel, { passive: false });
    return { destroy: () => node.removeEventListener('wheel', wheel) };
  }
  function key(e) {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d) { e.preventDefault(); nudge(d, e.shiftKey); }
  }
</script>

<div
  class="ruler" bind:clientWidth={w} tabindex="0" role="slider" aria-label={t('ruler.aria')}
  aria-valuemin="50" aria-valuemax="22000" aria-valuenow={value} aria-valuetext="{value} dpi"
  onpointerdown={down} onpointermove={move} onpointerup={() => (drag = null)} onkeydown={key} use:wheelable
>
  <svg viewBox="0 0 {w} {H}" aria-hidden="true">
    {#each ticks as t (t.dpi)}
      <line x1={t.x} x2={t.x} y1={t.major ? 26 : 40} y2={H} class:major={t.major} />
      {#if t.label}<text x={t.x} y="14">{fmt(t.dpi)}</text>{/if}
    {/each}
  </svg>
  <i class="needle"></i>
</div>
