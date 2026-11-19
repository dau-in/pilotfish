<script>
  // A macro, recorded from the keyboard and shown in time: a lane per key, a bar for each press as long as it was
  // held. It can be played back on screen before it is saved. Saving writes it to the mouse at once (a macro has a
  // report of its own), checks it by reading it back, and points the button at it.
  import { onDestroy, untrack } from 'svelte';
  import { mouse, readMacro, saveMacro } from '../device/mouse.svelte.js';
  import { errorText, t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';
  import { MACRO_IDS, keyLabel, usageFromCode } from './shared.js';
  import { macroSaved } from './studio.svelte.js';

  let { button, onclose } = $props();

  let mode = $state('times');
  let loops = $state(1);
  let events = $state([]); // { usage, down, delay }: the mouse's own steps, each with the pause after it
  let recording = $state(false);
  let saving = $state(false);
  let full = $state(false);
  let failed = $state(null);
  let loading = $state(untrack(() => button.raw[0] === 18));
  const max = mouse.maxMacroSteps;
  // A pause over 1.27 s takes a second slot in the mouse, so the limit counts slots, not steps.
  const slots = $derived(events.reduce((n, e) => n + (e.delay > 1270 ? 2 : 1), 0));

  $effect(() => {
    if (!loading) return;
    readMacro(button.id)
      .then(m => { if (!m.empty) { mode = m.mode; loops = m.loops; events = m.events; } })
      .catch(err => (failed = err))
      .finally(() => (loading = false));
  });

  /* ---------- Recording ---------- */
  let last = 0, t0 = 0, now = $state(0), raf = 0;
  function onKey(e) {
    if (!recording || e.repeat) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape' && e.type === 'keydown') { stop(); return; }
    const usage = usageFromCode(e.code);
    if (!usage) return;
    // A release without its press (a key held before Record) is left out.
    if (e.type === 'keyup' && !events.some(x => x.usage === usage && x.down)) return;
    const at = performance.now();
    if (!t0) t0 = at;
    if (events.length) events[events.length - 1].delay = Math.round((at - last) / 20) * 20;
    last = at;
    events.push({ usage, down: e.type === 'keydown', delay: 0 });
    if (slots >= max) { full = true; stop(); }
  }
  const tickRec = () => { now = performance.now() - t0; raf = requestAnimationFrame(tickRec); };
  function start() {
    events = []; full = false; recording = true; t0 = 0; now = 0;
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKey, true);
    raf = requestAnimationFrame(tickRec);
  }
  function stop() {
    if (!recording) return;
    recording = false;
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKey, true);
    cancelAnimationFrame(raf);
    // Every press gets its release, so no key is left held on the mouse.
    const held = new Set();
    for (const e of events) e.down ? held.add(e.usage) : held.delete(e.usage);
    for (const usage of held) { if (events.length) events[events.length - 1].delay ||= 40; events.push({ usage, down: false, delay: 0 }); }
  }
  onDestroy(() => { stop(); cancelAnimationFrame(playRaf); });

  /* ---------- The roll ---------- */
  const roll = $derived.by(() => {
    let at = 0;
    const timed = events.map(e => { const x = { ...e, t: at }; at += e.delay; return x; });
    const end = Math.max(600, timed.at(-1)?.t ?? 0, recording ? now : 0) + 80;
    const keys = [...new Set(timed.map(e => e.usage))];
    const rows = keys.map(usage => {
      const bars = []; let from = null;
      for (const e of timed) if (e.usage === usage) { if (e.down) from = e.t; else if (from !== null) { bars.push([from, e.t]); from = null; } }
      if (from !== null) bars.push([from, recording ? now : from + 20]);
      return { label: keyLabel(usage), bars };
    });
    const step = [50, 100, 200, 250, 500, 1000, 2000, 5000].find(s => end / s <= 5) ?? 10000;
    const ticks = [];
    for (let x = 0; x <= end - step / 3; x += step) ticks.push(x);
    return { end, rows, ticks };
  });
  const msText = x => (x >= 1000 ? t('macro.s', { n: x / 1000 }) : t('macro.ms', { n: x }));

  // Playing it back: a head runs across, and each bar lights while its key would be down.
  let playRaf = 0, head = $state(-1);
  function play() {
    cancelAnimationFrame(playRaf);
    const from = performance.now(), total = roll.end;
    const step = at => { const f = (at - from) / total; head = Math.min(1, f); if (f < 1) playRaf = requestAnimationFrame(step); else head = -1; };
    playRaf = requestAnimationFrame(step);
  }

  async function save() {
    saving = true; failed = null;
    try {
      await saveMacro(button.id, { mode, loops, events: $state.snapshot(events) });
      macroSaved(button.id, [18, 0, MACRO_IDS[button.id]]);
      onclose();
    } catch (err) {
      failed = err;
      saving = false;
    }
  }
  const MODES = ['times', 'untilKey', 'whileHeld'];
</script>

<div class="mbar">
  <button class="btn rec" class:on={recording} type="button" disabled={loading || saving} onclick={() => (recording ? stop() : start())}>
    <i class="recdot"></i>{t(recording ? 'macro.stop' : events.length ? 'macro.again' : 'macro.record')}
  </button>
  <button class="btn icon-start" type="button" disabled={!events.length || recording} onclick={play}><Icon name="play" />{t('macro.play')}</button>
  <button class="btn" type="button" disabled={!events.length || recording || saving} onclick={() => { events = []; full = false; }}>{t('macro.clear')}</button>
  <span class="count">{loading ? t('macro.readingShort') : t('macro.count', { n: slots, max })}</span>
</div>
<div class="roll">
  {#if roll.rows.length}
    <div class="rows">
      {#each roll.rows as r, k (k)}
        <div class="rrow"><span>{r.label}</span><div class="lane">
          {#each r.bars as [a, b], j (j)}
            {@const at = head * roll.end}
            <i class="bar" class:lit={head >= 0 && at >= a && at <= b} style:left="{(a / roll.end) * 100}%" style:width="{((b - a) / roll.end) * 100}%"></i>
          {/each}
        </div></div>
      {/each}
    </div>
    <div class="axis">{#each roll.ticks as x (x)}<span style:left="{(x / roll.end) * 100}%">{msText(x)}</span>{/each}</div>
    <i class="head" style:opacity={head >= 0 ? 1 : 0} style:--f={Math.max(0, head)}></i>
  {:else}
    <p class="empty">{t(loading ? 'macro.reading' : recording ? 'macro.hintRecording' : 'macro.hint')}</p>
  {/if}
</div>
{#if full}<p class="fine">{t('macro.full', { max })}</p>{/if}
{#if failed}<p class="warn" style:margin-top="10px">{t('macro.failed', { msg: errorText(failed) })}</p>{/if}
<p class="grp">{t('macro.repeat')}</p>
<div class="seg inset" role="radiogroup" aria-label={t('macro.repeat')}>
  {#each MODES as m (m)}
    <button type="button" role="radio" aria-checked={mode === m} onclick={() => (mode = m)}>{m === 'times' ? t('macro.timesN', { n: loops }) : t(`macro.${m}`)}</button>
  {/each}
</div>
{#if mode === 'times'}
  <div class="rowline"><span>{t('macro.timesLabel')}<small>{t('macro.timesNote')}</small></span>
    <div class="stepper">
      <button class="round" type="button" aria-label={t('macro.fewer')} disabled={loops <= 1} onclick={() => loops--}>−</button>
      <output class="fig">{loops}</output>
      <button class="round" type="button" aria-label={t('macro.more')} disabled={loops >= 255} onclick={() => loops++}>+</button>
    </div>
  </div>
{/if}
<p class="fine">{t('macro.round')}</p>
<div class="efoot">
  <button class="btn" type="button" onclick={() => { stop(); onclose(); }}>{t('action.cancel')}</button>
  <button class="btn go" type="button" disabled={!events.length || recording || saving || loading || slots > max} onclick={save}>{t(saving ? 'macro.saving' : 'macro.save')}</button>
</div>
