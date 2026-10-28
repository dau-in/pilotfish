<script>
  // The signature: the six DPI levels in the order the DPI button walks them, on one 0–24 000 scale, with the
  // sensor's native ceiling dashed and the interpolated part of a level hatched.
  import { t } from '../i18n/index.svelte.js';
  import { NATIVE_MAX, fmt, isDoubled } from './shared.js';

  let { levels, activeLevel, editing, onpick } = $props();

  let W = $state(0);
  const H = 340;
  const m = { l: 52, r: 8, t: 22, b: 40 };
  const MAX = 24000, TICKS = [0, 6000, 12000, 18000, 24000];
  const ph = H - m.t - m.b;
  const y = v => m.t + ph - (v / MAX) * ph;
  const band = $derived((W - m.l - m.r) / levels.length);
  const bw = $derived(Math.min(44, band * 0.46));
</script>

<div class="chart-wrap" bind:clientWidth={W}>
  {#if W}
    <svg class="chart" viewBox="0 0 {W} {H}" style:height="{H}px" role="img" aria-label={t('chart.aria')}>
      <defs>
        <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M-1 1l2-2M0 4l4-4M3 5l2-2" stroke="currentColor" stroke-width="1.2" />
        </pattern>
      </defs>
      {#each TICKS as t (t)}
        {#if t}<line class="gridline" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />{/if}
        <text class="tick" x={m.l - 10} y={y(t) + 4} text-anchor="end">{fmt(t)}</text>
      {/each}
      <line class="baseline" x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} />

      {#each levels as l, i (i)}
        {@const cx = m.l + band * i + band / 2}
        {@const x = cx - bw / 2}
        {@const color = activeLevel === i + 1 ? 'var(--accent)' : 'var(--bar)'}
        {@const native = Math.min(l.dpi, NATIVE_MAX)}
        <g class="bar" onclick={() => onpick(i + 1)} role="presentation">
          <rect class="hit" x={m.l + band * i} y={m.t} width={band} height={ph + m.b} />
          <rect {x} y={y(native)} width={bw} height={y(0) - y(native)} fill={color} />
          {#if isDoubled(l.dpi)}
            <!-- The interpolated part: hatched in the bar's own colour. -->
            <rect {x} y={y(l.dpi)} width={bw} height={y(NATIVE_MAX) - y(l.dpi)} fill="url(#hatch)" style:color={color} />
            <rect x={x + 0.5} y={y(l.dpi) + 0.5} width={bw - 1} height={y(NATIVE_MAX) - y(l.dpi) - 1} fill="none" stroke={color} />
          {/if}
          <text class="value" x={cx} y={y(l.dpi) - 7} text-anchor="middle">{fmt(l.dpi)}</text>
          <text class="xlabel" class:editing={editing === i + 1} x={cx} y={H - m.b + 22} text-anchor="middle">{t('dpi.short', { n: i + 1 })}</text>
          {#if editing === i + 1}<line class="sel" x1={cx - 9} x2={cx + 9} y1={H - m.b + 29} y2={H - m.b + 29} />{/if}
        </g>
      {/each}

      <!-- The sensor's native ceiling, labelled over the first band (low levels leave it free). -->
      <line class="ref" x1={m.l} x2={W - m.r} y1={y(NATIVE_MAX)} y2={y(NATIVE_MAX)} />
      <text class="ref-label" x={m.l + 6} y={y(NATIVE_MAX) - 6}>{t('chart.nativeMax')}</text>
    </svg>
  {/if}
</div>
