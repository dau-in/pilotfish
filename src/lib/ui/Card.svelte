<script>
  // The card: the part you touched, beside the mouse (a sheet on smaller screens). Every edit goes into the draft;
  // nothing reaches the mouse until Apply.
  import { tick } from 'svelte';
  import { mouse } from '../device/mouse.svelte.js';
  import { fmt, i18n, locale, t } from '../i18n/index.svelte.js';
  import { DPI_MAX, DPI_MIN, RESPONSE_RANGE, SLEEP_RANGE } from '../protocol/index.js';
  import ButtonEditor from './ButtonEditor.svelte';
  import Icon from './Icon.svelte';
  import { battery, daysLeft } from './battery.svelte.js';
  import { LIGHT, NATIVE_MAX, PRESET_COLORS, ownColor, snapDpi, stepDpi } from './shared.js';
  import { studio } from './studio.svelte.js';
  import { PARTS, view } from './view.svelte.js';

  let { el = $bindable(), engine } = $props();

  const d = $derived(studio.draft);
  const p = $derived(mouse.profile);
  const o = $derived(view.open);
  const kind = $derived(mouse.kind ?? 'dongle');
  const BUTTONS = ['left', 'right', 'wheel', 'forward', 'back', 'dpi'];

  // Each card comes in as it opens, even straight after another one.
  let on = $state(false);
  let key = $derived(o ? `${o.kind}:${o.id}` : '');
  $effect(() => {
    if (!key) { on = false; return; }
    on = false;
    requestAnimationFrame(() => { on = true; tick().then(() => el?.querySelector('[data-close]')?.focus({ preventScroll: true })); });
  });
  const close = () => { view.open = null; };
  const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

  /* ---------- A DPI level ---------- */
  function levelInput(e, i) {
    const v = parseInt(e.currentTarget.value.replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(v)) d.levels[i].dpi = snapDpi(v);
    e.currentTarget.value = d.levels[i].dpi;
  }

  /* ---------- The Mode switch: its three lights, as the manual tells them ---------- */
  const GUIDE = [['red-fast', ['#ff3b30']], ['green-fast', ['#34c759', '#4a8bff']], ['green-slow', ['#34c759']], ['red-once', ['#ff3b30']]];
  let pattern = $state(null);
  $effect(() => { if (o?.id !== 'pair') pattern = null; });
  const play = pt => engine?.playPattern(pt);

  /* ---------- The battery over the week ---------- */
  const SW = 340, SH = 78;
  const spark = $derived.by(() => {
    const now = Date.now(), from = now - 7 * 86400e3, pts = battery.log.filter(x => x.at >= from);
    if (pts.length < 2) return null;
    const xs = at => ((at - from) / (now - from)) * SW, ys = v => SH - (v / 100) * SH;
    const line = pts.map((x, i) => `${i ? 'L' : 'M'}${xs(x.at).toFixed(1)} ${ys(x.level).toFixed(1)}`).join('');
    const days = Array.from({ length: 7 }, (_, k) => new Date(from + (k + 0.5) * 86400e3).toLocaleDateString(locale(), { weekday: 'short' }));
    return { line, area: `${line}L${xs(pts.at(-1).at).toFixed(1)} ${SH}L${xs(pts[0].at).toFixed(1)} ${SH}Z`, ys, days, first: pts[0].level, last: pts.at(-1).level };
  });
</script>

{#snippet head(id, line, icon = PARTS[id]?.icon)}
  <header class="ehead">
    <span class="ic"><Icon name={icon} /></span>
    <div><h3 class="disp">{t(`part.${id}`)}</h3>{#if line}<p>{@html line}</p>{/if}</div>
    <button class="iconbtn x" type="button" data-close aria-label={t('card.close', { name: t(`part.${id}`) })} onclick={close}><Icon name="close" /></button>
  </header>
{/snippet}

{#snippet swatches(current, set)}
  <div class="swatches">
    {#each PRESET_COLORS as c (c)}
      <button class="sw" type="button" style:--c={c} aria-pressed={current.toLowerCase() === c} aria-label={c} onclick={() => set(c)}></button>
    {/each}
    <label class="sw custom" title={t('card.anyColor')}><input type="color" value={current} aria-label={t('card.anyColor')} oninput={e => set(e.currentTarget.value)}></label>
  </div>
{/snippet}

{#snippet stepper(value, unit, range, step, set, less, more)}
  <div class="stepper">
    <button class="round" type="button" disabled={value <= range[0]} aria-label={less} onclick={() => set(clamp(value - step, range))}>−</button>
    <output><span class="fig">{value}</span> {unit}</output>
    <button class="round" type="button" disabled={value >= range[1]} aria-label={more} onclick={() => set(clamp(value + step, range))}>+</button>
  </div>
{/snippet}

{#snippet meter(name, value, active, set)}
  <div class="meter" class:off={!active} role="group" aria-label={t(`light.${name}`)}>
    {#each { length: 8 } as _, i (i)}
      <button type="button" class:on={i < value} style:height="{6 + i * 2}px" disabled={!active} aria-label={t('light.step', { what: t(`light.${name}`), n: i + 1 })} onclick={() => set(i + 1)}></button>
    {/each}
    <output class="fig">{active ? value : ''}</output>
  </div>
{/snippet}

<div class="card" class:on bind:this={el} role="dialog" aria-modal="false" aria-label={o ? (o.kind === 'level' ? t('dpi.level', { n: o.id + 1 }) : t(`part.${o.id}`)) : undefined}>
  {#if o && d && p}
    {#key key + i18n.lang}
      {#if o.kind === 'level'}
        {@const i = o.id}
        {@const l = d.levels[i]}
        {@const was = p.levels[i].dpi}
        <header class="ehead">
          <span class="ic"><i class="lvdot" style:--c={l.color}></i></span>
          <div><h3 class="disp">{t('dpi.level', { n: i + 1 })}</h3><p>{t('level.stop', { n: i + 1 })}{#if i === d.activeLevel - 1}{' '}<b>{t('level.inUse')}</b>{/if}</p></div>
          <button class="iconbtn x" type="button" data-close aria-label={t('card.close', { name: t('dpi.level', { n: i + 1 }) })} onclick={close}><Icon name="close" /></button>
        </header>
        <div class="rowline">
          <span>DPI<small>{l.dpi > NATIVE_MAX ? t('level.doubled', { half: fmt(l.dpi / 2) }) : l.dpi !== was ? t('level.was', { dpi: fmt(was) }) : t('level.steps')}</small></span>
          <div class="stepper">
            <button class="round" type="button" disabled={l.dpi <= DPI_MIN} aria-label={t('dpi.down')} onclick={() => (l.dpi = stepDpi(l.dpi, -1))}>−</button>
            <input class="dot" inputmode="numeric" value={l.dpi} aria-label={t('level.input', { n: i + 1 })} onchange={e => levelInput(e, i)} onkeydown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}>
            <button class="round" type="button" disabled={l.dpi >= DPI_MAX} aria-label={t('dpi.up')} onclick={() => (l.dpi = stepDpi(l.dpi, 1))}>+</button>
          </div>
        </div>
        <p class="grp">{t('level.color')}</p>
        {@render swatches(l.color, c => (l.color = c))}
        {#if i !== d.activeLevel - 1}
          <div class="efoot start"><button class="btn" type="button" onclick={() => { d.activeLevel = i + 1; engine?.flashLed(); }}>{t('level.use')}</button></div>
        {/if}

      {:else if BUTTONS.includes(o.id)}
        <ButtonEditor part={o.id} {close} />

      {:else if o.id === 'led'}
        {@const L = d.lighting}
        {@const uses = LIGHT[L.mode] ?? {}}
        {@render head('led', t('led.lede'))}
        <div class="modes" role="radiogroup" aria-label={t('light.mode')}>
          {#each LIGHT as _, n (n)}
            <button class="mode-opt" type="button" role="radio" aria-checked={L.mode === n} title={t(`lightMode.${n}.note`)} onclick={() => (L.mode = n)}>
              <i class="mini" class:off={n === 0} class:breathe={[2, 4, 6].includes(n)} class:neon={n === 3 || n === 4} style:--c={ownColor(n) ? L.color : d.levels[d.activeLevel - 1].color}></i>{t(`lightMode.${n}`)}
            </button>
          {/each}
        </div>
        <div class="rowline" style:margin-top="8px"><span>{t('light.brightness')}</span>{@render meter('brightness', L.brightness, uses.brightness, v => (L.brightness = v))}</div>
        <div class="rowline"><span>{t('light.speed')}</span>{@render meter('speed', L.speed, uses.speed, v => (L.speed = v))}</div>
        {#if uses.color}
          <p class="grp">{t('light.color')}</p>
          {@render swatches(L.color, c => (L.color = c))}
        {:else if L.mode >= 5}
          <p class="fine">{t('led.byLevel')}</p>
        {/if}
        <p class="fine">{t('led.also')}</p>

      {:else if o.id === 'sensor'}
        {@render head('sensor', t('sensor.lede'))}
        <p class="grp first">{t('polling.title')}</p>
        <div class="seg inset" role="radiogroup" aria-label={t('polling.title')}>
          {#each [125, 250, 500, 1000] as hz (hz)}
            <button type="button" role="radio" aria-checked={d.pollingHz === hz} disabled={!mouse.canChangePolling} onclick={() => (d.pollingHz = hz)}><span class="fig">{hz}</span> Hz</button>
          {/each}
        </div>
        <p class="fine">{mouse.canChangePolling ? t('polling.note') : t('polling.bluetooth')}</p>
        <div class="rowline" style:margin-top="6px"><span>{t('sensor.snap')}<small>{t('sensor.snapNote')}</small></span>
          <button class="chip" type="button" aria-pressed={d.angleSnap} onclick={() => (d.angleSnap = !d.angleSnap)}>{t(d.angleSnap ? 'card.on' : 'card.off')}</button></div>
        <div class="rowline"><span>{t('sensor.ripple')}<small>{t('sensor.rippleNote')}</small></span>
          <button class="chip" type="button" aria-pressed={d.ripple} onclick={() => (d.ripple = !d.ripple)}>{t(d.ripple ? 'card.on' : 'card.off')}</button></div>
        <div class="rowline"><span>{t('power.response')}<small>{t('power.responseNote')}</small></span>
          {@render stepper(d.keyResponseMs, 'ms', RESPONSE_RANGE, RESPONSE_RANGE[2], v => (d.keyResponseMs = v), t('power.fewerMs'), t('power.moreMs'))}</div>

      {:else if o.id === 'power'}
        {@const at = { dongle: 0, cable: 1, bluetooth: 2 }[kind]}
        {@render head('power', t(`power.lede.${kind}`))}
        <div class="positions">
          {#each ['dongle', 'off', 'bluetooth'] as pos, n (pos)}
            <div class:now={n === at}><span>{t(`power.pos.${pos}`)}</span><span>{n === at ? t('power.now') : ''}</span></div>
          {/each}
        </div>
        <div class="rowline" style:margin-top="10px"><span>{t('power.sleepAfter')}<small>{t('power.sleepNote')}</small></span>
          {@render stepper(d.sleepMinutes, 'min', SLEEP_RANGE, 1, v => (d.sleepMinutes = v), t('power.fewerMin'), t('power.moreMin'))}</div>

      {:else if o.id === 'pair'}
        {@render head('pair', t('pair.lede'))}
        <p class="grp first">{t('pair.lights')}</p>
        <div class="guide">
          {#each GUIDE as [k, dots] (k)}
            <button class="grow" class:lit={pattern === k} type="button" onclick={() => { pattern = pattern === k ? null : k; play(pattern); }}
              onpointerenter={() => play(k)} onpointerleave={() => play(pattern)} onfocus={() => play(k)} onblur={() => play(pattern)}>
              <span class="dots">{#each dots as c (c)}<i class="gdot" style:--c={c}></i>{/each}</span>
              <span><b>{t(`pair.${k}`)}</b><small>{t(`pair.${k}.note`)}</small></span>
            </button>
          {/each}
        </div>
        <p class="fine">{t('pair.fine')}</p>

      {:else if o.id === 'contacts'}
        {@const bat = mouse.battery}
        {@const days = bat?.state === 'battery' ? daysLeft(bat.level) : null}
        {@render head('contacts', t('contacts.lede'))}
        {#if bat}
          <div class="rowline"><span><span class="dot big">{bat.state === 'full' ? 100 : bat.level}</span> %<small>{bat.state === 'battery' ? t('battery.days', { n: days }) : t(`battery.${bat.state}Now`)}</small></span></div>
        {:else}
          <p class="fine">{t('say.batteryUnread')}</p>
        {/if}
        {#if spark}
          <svg class="spark" viewBox="0 0 {SW} {SH}" preserveAspectRatio="none" role="img" aria-label={t('contacts.sparkAria', { from: spark.first, to: spark.last })}>
            <defs><linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--acc)" stop-opacity=".28"/><stop offset="1" style="stop-color:var(--acc)" stop-opacity="0"/></linearGradient></defs>
            {#each [0, 50, 100] as v (v)}<line class="grid" x1="0" x2={SW} y1={spark.ys(v)} y2={spark.ys(v)} />{/each}
            <path class="area" d={spark.area} /><path class="line" d={spark.line} />
          </svg>
          <div class="sparkx">{#each spark.days as x, k (k)}<span>{x}</span>{/each}<span>{t('contacts.now')}</span></div>
        {:else}
          <p class="fine">{t('contacts.early')}</p>
        {/if}
        <p class="fine">{t('contacts.fine')}</p>

      {:else if o.id === 'bay'}
        {@render head('bay', t(kind === 'dongle' ? 'bay.ledeIn' : 'bay.ledeOut'))}
        <div class="rowline"><span>{t('bay.connection')}<small>{t(`bay.${kind}`)}</small></span></div>
        <div class="rowline"><span>{t('bay.stuck')}<small>{t('bay.stuckNote')}</small></span></div>

      {:else if o.id === 'usbc'}
        {@render head('usbc', t('usbc.lede'))}
        <div class="rowline"><span>{t('usbc.saving')}<small>{t('usbc.savingNote')}</small></span>{#if kind === 'cable'}<span class="here">{t('power.now')}</span>{/if}</div>
        <p class="fine">{t('usbc.fine')}</p>
      {/if}
    {/key}
  {/if}
</div>
