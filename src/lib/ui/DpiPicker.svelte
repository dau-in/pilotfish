<script>
  // Faders or Dial, each shown as a small picture of itself in the levels' own colours.
  import { DPI_MAX } from '../protocol/index.js';
  import { t } from '../i18n/index.svelte.js';
  import { DPI_VIEWS, prefs, setPref } from './prefs.svelte.js';
  import { studio } from './studio.svelte.js';

  const L = $derived(studio.draft?.levels ?? []);
  const active = $derived((studio.draft?.activeLevel ?? 1) - 1);
  const posR = dpi => Math.max(0, Math.min(1, (Math.log10(Math.max(100, dpi)) - 2) / (Math.log10(DPI_MAX) - 2)));
  const pt = (a, r) => { const th = (a * Math.PI) / 180; return [66 + r * Math.cos(th), 56 - r * Math.sin(th)]; };
  const [x0, y0] = pt(200, 48), [x1, y1] = pt(-20, 48);
</script>

<div class="dpick" role="radiogroup" aria-label={t('settings.dpiView')}>
  {#each DPI_VIEWS as v (v)}
    <button type="button" role="radio" aria-checked={prefs.dpiView === v} onclick={() => setPref('dpiView', v)}>
      {#if v === 'faders'}
        <svg viewBox="0 0 132 62" aria-hidden="true">
          {#each L as l, i (i)}
            {@const x = 11 + i * 22}
            {@const y = 54 - posR(l.dpi) * 46}
            <line class="trk" x1={x} y1="6" x2={x} y2="56" /><rect x={x - 7} y={(y - 3).toFixed(1)} width="14" height="6" rx="1" fill={l.color} />
          {/each}
        </svg>
      {:else}
        {@const [nx, ny] = pt(200 - posR(L[active]?.dpi ?? 800) * 220, 34)}
        <svg viewBox="0 0 132 62" aria-hidden="true">
          <path class="arc" d="M{x0.toFixed(1)} {y0.toFixed(1)}A48 48 0 1 1 {x1.toFixed(1)} {y1.toFixed(1)}" />
          {#each L as l, i (i)}{@const [x, y] = pt(200 - posR(l.dpi) * 220, 48)}<circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="4" fill={l.color} />{/each}
          <line class="ndl" x1="66" y1="56" x2={nx.toFixed(1)} y2={ny.toFixed(1)} /><circle cx="66" cy="56" r="4" fill="var(--text)" />
        </svg>
      {/if}
      <span>{t(`settings.view.${v}`)}</span>
    </button>
  {/each}
</div>
