<script>
  // Settings in two columns: what each one does on the left, its control on the right.
  import { mouse } from '../device/mouse.svelte.js';
  import { LANGS, i18n, locale, setLang, t } from '../i18n/index.svelte.js';
  import { SHELLS, look, setShell } from './look.svelte.js';
  import { LIGHT, PRESET_COLORS, linkName } from './shared.js';
  import BackupsPanel from './BackupsPanel.svelte';
  import { studio } from './studio.svelte.js';

  const d = $derived(studio.draft);
  const modeIndex = $derived(LIGHT[d.lighting.mode] ? d.lighting.mode : 0);
  const mode = $derived(LIGHT[modeIndex]);
  const USB_ID = { cable: '1D57:FA55', dongle: '1D57:FA60', bluetooth: '045E:0055 (Bluetooth)' };
  const POLLING = [125, 250, 500, 1000];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const battery = $derived(mouse.battery ? t('battery.value', mouse.battery) : null);
</script>

{#snippet stepper(value, unit, lo, hi, step, set, less, more)}
  <div class="mini-stepper">
    <button class="round" type="button" aria-label={less} disabled={value - step < lo} onclick={() => set(clamp(value - step, lo, hi))}>−</button>
    <output class="num">{value}</output><span class="unit">{unit}</span>
    <button class="round" type="button" aria-label={more} disabled={value + step > hi} onclick={() => set(clamp(value + step, lo, hi))}>+</button>
  </div>
{/snippet}

<section class="screen settings" aria-labelledby="title">
  <div class="setting">
    <div class="s-label">
      <h2>{t('polling.title')}</h2>
      <p>{t('polling.body')}</p>
    </div>
    <div class="s-panel">
      {#if mouse.canChangePolling}
        <div class="seg" role="radiogroup" aria-label={t('polling.title')}>
          {#each POLLING as hz (hz)}
            <button type="button" role="radio" aria-checked={d.pollingHz === hz} onclick={() => (d.pollingHz = hz)}>{hz} Hz</button>
          {/each}
        </div>
        <p class="hint">{t('polling.every', { ms: (1000 / d.pollingHz).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}</p>
      {:else}
        <p class="hint">{t('polling.bluetooth')}</p>
      {/if}
    </div>
  </div>

  <div class="setting">
    <div class="s-label">
      <h2>{t('sensor.title')}</h2>
      <p>{t('sensor.body')}</p>
    </div>
    <div class="s-panel">
      <label class="switch-row">
        <span><b>{t('sensor.snap')}</b><small>{t('sensor.snapNote')}</small></span>
        <input type="checkbox" bind:checked={d.angleSnap}><i class="toggle" aria-hidden="true"></i>
      </label>
      <label class="switch-row">
        <span><b>{t('sensor.ripple')}</b><small>{t('sensor.rippleNote')}</small></span>
        <input type="checkbox" bind:checked={d.ripple}><i class="toggle" aria-hidden="true"></i>
      </label>
    </div>
  </div>

  <div class="setting">
    <div class="s-label">
      <h2>{t('light.title')}</h2>
      <p>{t('light.body')}</p>
    </div>
    <div class="s-panel">
      <div class="power-row">
        <span><b>{t('light.mode')}</b><small>{t(`lightMode.${modeIndex}.note`)}</small></span>
        <select class="field-select" aria-label={t('light.modeAria')} value={d.lighting.mode} onchange={e => (d.lighting.mode = +e.currentTarget.value)}>
          {#each LIGHT as _, i (i)}<option value={i}>{t(`lightMode.${i}`)}</option>{/each}
        </select>
      </div>
      {#if mode.color}
        <div class="power-row">
          <span><b>{t('light.color')}</b><small>{t('light.colorNote')}</small></span>
          <div class="swatches">
            {#each PRESET_COLORS as c (c)}
              <button type="button" class="swatch" style:--c={c} aria-label={t('light.swatch', { c })} aria-pressed={d.lighting.color.toLowerCase() === c}
                onclick={() => (d.lighting.color = c)}></button>
            {/each}
          </div>
        </div>
      {/if}
      {#if mode.brightness}
        <div class="power-row">
          <span><b>{t('light.brightness')}</b><small>{t('light.brightnessNote')}</small></span>
          {@render stepper(d.lighting.brightness, t('light.of8'), 1, 8, 1, v => (d.lighting.brightness = v), t('light.dimmer'), t('light.brighter'))}
        </div>
      {/if}
      {#if mode.speed}
        <div class="power-row">
          <span><b>{t('light.speed')}</b><small>{t('light.speedNote')}</small></span>
          {@render stepper(d.lighting.speed, t('light.of8'), 1, 8, 1, v => (d.lighting.speed = v), t('light.slower'), t('light.faster'))}
        </div>
      {/if}
    </div>
  </div>

  <div class="setting">
    <div class="s-label">
      <h2>{t('power.title')}</h2>
      <p>{t('power.body')}</p>
    </div>
    <div class="s-panel">
      <div class="power-row">
        <span><b>{t('power.sleep')}</b><small>{t('power.sleepNote')}</small></span>
        {@render stepper(d.sleepMinutes, t('power.min'), 1, 60, 1, v => (d.sleepMinutes = v), t('power.fewerMin'), t('power.moreMin'))}
      </div>
      <div class="power-row">
        <span><b>{t('power.response')}</b><small>{t('power.responseNote')}</small></span>
        {@render stepper(d.keyResponseMs, t('power.ms'), 4, 50, 2, v => (d.keyResponseMs = v), t('power.fewerMs'), t('power.moreMs'))}
      </div>
    </div>
  </div>

  <BackupsPanel />

  <div class="setting">
    <div class="s-label">
      <h2>{t('device.title')}</h2>
      <p>{t('device.body')}</p>
    </div>
    <div class="s-panel">
      <div class="power-row">
        <span><b>{t('device.shell')}</b><small>{t('device.shellNote')}</small></span>
        <div class="seg" role="radiogroup" aria-label={t('device.shell')}>
          {#each SHELLS as id (id)}
            <button type="button" role="radio" aria-checked={look.shell === id} onclick={() => setShell(id)}>{t(`shell.${id}`)}</button>
          {/each}
        </div>
      </div>
      <div class="power-row">
        <span><b>{t('device.lang')}</b><small>{t('device.langNote')}</small></span>
        <div class="seg" role="radiogroup" aria-label={t('device.lang')}>
          {#each Object.entries(LANGS) as [id, name] (id)}
            <button type="button" role="radio" lang={id} aria-checked={i18n.lang === id} onclick={() => setLang(id)}>{name}</button>
          {/each}
        </div>
      </div>
      <dl class="kv">
        <div><dt>{t('device.model')}</dt><dd>Attack Shark X11</dd></div>
        <div><dt>{t('device.firmware')}</dt><dd class="num">{mouse.version ?? '—'}</dd></div>
        <div><dt>{t('device.link')}</dt><dd>{linkName(mouse.kind) ?? '—'}</dd></div>
        <div><dt>{t('device.battery')}</dt><dd>{battery ?? '—'}</dd></div>
        <div><dt>{t('device.usbId')}</dt><dd class="id">{USB_ID[mouse.kind] ?? '—'}</dd></div>
      </dl>
    </div>
  </div>
</section>
