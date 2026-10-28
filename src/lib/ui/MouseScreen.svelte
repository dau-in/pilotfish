<script>
  // The screen's question: what DPI does each press of the DPI button give? The cycle chart answers it, beside the
  // mouse itself and the level table; the selected level is edited underneath.
  import CycleChart from './CycleChart.svelte';
  import DpiRuler from './DpiRuler.svelte';
  import { t } from '../i18n/index.svelte.js';
  import MouseRender from './MouseRender.svelte';
  import { PRESET_COLORS, dpiStep, fmt, isDoubled, snapDpi } from './shared.js';
  import { studio } from './studio.svelte.js';

  let { led } = $props();

  const d = $derived(studio.draft);
  const edited = $derived(d.levels[studio.editing - 1]);
  const active = $derived(d.levels[d.activeLevel - 1]);
  const pick = n => (studio.editing = n);
  const setDpi = v => { edited.dpi = snapDpi(v); };
  const nudge = (dir, big) => setDpi(edited.dpi + dir * (big ? 500 : dpiStep(edited.dpi)));
  const isCustom = $derived(!PRESET_COLORS.includes(edited.color.toLowerCase()));
</script>

<section class="screen" aria-labelledby="title">
  <article class="panel lead">
    <div class="cycle">
      <div class="chart-head">
        <h2>{t('dpi.cycle')}</h2>
        <p class="legend"><span><i class="key solid"></i>{t('dpi.native')}</span><span><i class="key hatch"></i>{t('dpi.interpolated')}</span></p>
      </div>
      <CycleChart levels={d.levels} activeLevel={d.activeLevel} editing={studio.editing} onpick={pick} />
      <p class="meta">{t('dpi.cycleNote')}</p>
    </div>

    <figure class="device">
      <MouseRender {led} />
      <figcaption><span>{t('dpi.levelInUse', { n: d.activeLevel })}</span><span class="id">{active.color.toUpperCase()}</span></figcaption>
    </figure>

    <div class="levels">
      <div class="chart-head"><h2>{t('dpi.levels')}</h2><p class="meta">{t('dpi.unit')}</p></div>
      <div class="rows">
        {#each d.levels as l, i (i)}
          <button
            type="button" class="lv" style:--c={l.color} aria-pressed={studio.editing === i + 1} onclick={() => pick(i + 1)}
            aria-label={t('dpi.editLevel', { n: i + 1, dpi: l.dpi, inUse: d.activeLevel === i + 1 })}
          >
            <i class="swatch-dot"></i>
            <span class="name">{t('dpi.level', { n: i + 1 })}</span>
            <span class="pill" class:ghost={d.activeLevel !== i + 1}>{t('dpi.inUse')}</span>
            <span class="v">{fmt(l.dpi)}<small>{isDoubled(l.dpi) ? '×2' : ''}</small></span>
          </button>
        {/each}
      </div>
    </div>
  </article>

  <article class="panel editor">
    <div class="ed-head">
      <h2>{t('dpi.level', { n: studio.editing })}</h2>
      <p class="meta">
        {isDoubled(edited.dpi) ? t('dpi.interpolatedNote', { half: fmt(edited.dpi / 2) }) : t('dpi.nativeNote')}
      </p>
    </div>
    <div class="ed-grid">
      <div class="ed-value">
        <label class="field-label" for="dpi-input">DPI</label>
        <div class="stepper">
          <button class="round" type="button" aria-label={t('dpi.down')} onclick={e => nudge(-1, e.shiftKey)}>−</button>
          <input
            id="dpi-input" class="num" type="number" min="50" max="22000" inputmode="numeric" value={edited.dpi}
            onchange={e => setDpi(+e.currentTarget.value)} onkeydown={e => e.key === 'Enter' && e.currentTarget.blur()}
          >
          <button class="round" type="button" aria-label={t('dpi.up')} onclick={e => nudge(1, e.shiftKey)}>+</button>
        </div>
        <p class="hint">{t('dpi.step', { step: dpiStep(edited.dpi) })}</p>
      </div>
      <DpiRuler value={edited.dpi} onchange={setDpi} />
      <div class="ed-led">
        <p class="field-label">{t('dpi.ledColor')}</p>
        <div class="swatches">
          {#each PRESET_COLORS as c (c)}
            <button type="button" class="swatch" style:--c={c} aria-label={t('dpi.led', { c })} aria-pressed={edited.color.toLowerCase() === c}
              onclick={() => (edited.color = c)}></button>
          {/each}
          <label class="swatch custom" title={t('dpi.otherColor')} style:--c={edited.color} aria-pressed={isCustom}>
            +<input type="color" aria-label={t('dpi.otherLed')} value={edited.color} oninput={e => (edited.color = e.currentTarget.value)}>
          </label>
        </div>
      </div>
      <div class="ed-active">
        <button class="btn" type="button" disabled={d.activeLevel === studio.editing} onclick={() => (d.activeLevel = studio.editing)}>
          {t(d.activeLevel === studio.editing ? 'dpi.isActive' : 'dpi.makeActive')}
        </button>
      </div>
    </div>
  </article>
</section>
