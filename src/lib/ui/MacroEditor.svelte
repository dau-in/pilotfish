<script>
  // One macro per button, kept in the mouse. Recording turns keydown/keyup into steps; each step's pause is the
  // time until the next one. Saving writes it (verified by reading it back) and assigns it to the button.
  import { onDestroy, untrack } from 'svelte';
  import { mouse, readMacro, saveMacro } from '../device/mouse.svelte.js';
  import { t } from '../i18n/index.svelte.js';
  import { MACRO_IDS, buttonName, keyLabel, usageFromCode } from './shared.js';
  import { setStamp } from './studio.svelte.js';

  let { button, onclose } = $props();

  let mode = $state('times');
  let loops = $state(1);
  let events = $state([]);
  let recording = $state(false);
  let saving = $state(false);
  // Only the button it opened with matters: the editor is closed and reopened for another one.
  let loading = $state(untrack(() => button.raw[0] === 18));

  // A pause over 1.27 s takes a second slot in the mouse, so the limit counts slots, not steps.
  const slots = $derived(events.reduce((n, e) => n + (e.delay > 1270 ? 2 : 1), 0));
  const max = mouse.maxMacroSteps;

  $effect(() => {
    if (!loading) return;
    readMacro(button.id)
      .then(m => { if (!m.empty) { mode = m.mode; loops = m.loops; events = m.events; } })
      .catch(err => setStamp('stamp.macroReadFailed', { err }))
      .finally(() => (loading = false));
  });

  let last = 0;
  function onKey(e) {
    if (!recording || e.repeat) return;
    e.preventDefault();
    const usage = usageFromCode(e.code);
    if (!usage) return;
    const now = performance.now();
    if (events.length) events[events.length - 1].delay = Math.round((now - last) / 20) * 20;
    last = now;
    events.push({ usage, down: e.type === 'keydown', delay: 0 });
    if (slots >= max) stop();
  }
  function start() {
    events = [];
    recording = true;
    last = performance.now();
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKey, true);
  }
  function stop() {
    recording = false;
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKey, true);
  }
  onDestroy(stop);

  async function save() {
    saving = true;
    setStamp('stamp.savingMacro');
    try {
      await saveMacro(button.id, { mode, loops, events: $state.snapshot(events) });
      button.raw = [18, 0, MACRO_IDS[button.id]]; // already assigned on the mouse; mirror it in the draft
      setStamp('stamp.macroSaved', { at: new Date() });
      onclose();
    } catch (err) {
      setStamp('stamp.macroFailed', { err });
      saving = false;
    }
  }
  const nameOf = () => t('macro.title', { name: buttonName(button.id) });
</script>

<article class="panel macro-editor" aria-label={nameOf()}>
  <div class="chart-head">
    <h2>{nameOf()}</h2>
    <p class="meta">{loading ? t('macro.reading') : t('macro.count', { n: slots, max })}</p>
  </div>
  <div class="macro-grid">
    <div>
      <div class="macro-bar">
        <button class="btn" class:recording type="button" disabled={loading || saving} onclick={() => (recording ? stop() : start())}>
          {t(recording ? 'macro.stop' : events.length ? 'macro.again' : 'macro.record')}
        </button>
        <button class="btn ghost" type="button" disabled={!events.length || recording || saving} onclick={() => (events = [])}>{t('macro.clear')}</button>
        <p class="hint">{t(recording ? 'macro.hintRecording' : 'macro.hint')}</p>
      </div>
      <table class="assign macro-table">
        <thead><tr><th scope="col">{t('macro.colKey')}</th><th scope="col">{t('macro.colAction')}</th><th scope="col" class="state-col">{t('macro.colPause')}</th><th scope="col"><span class="sr">{t('macro.colRemove')}</span></th></tr></thead>
        <tbody>
          {#each events as e, i (i)}
            <tr>
              <td><span>{keyLabel(e.usage)}</span></td>
              <td>{t(e.down ? 'macro.press' : 'macro.release')}</td>
              <td>
                <input type="number" min="0" max="25000" step="20" aria-label={t('macro.pauseAria', { n: i + 1 })} value={e.delay} disabled={recording || saving}
                  onchange={ev => (e.delay = Math.max(0, Math.min(25000, Math.round(+ev.currentTarget.value / 20) * 20)))}><span class="unit">ms</span>
              </td>
              <td><button class="btn ghost" type="button" disabled={recording || saving} onclick={() => events.splice(i, 1)}>{t('macro.remove')}</button></td>
            </tr>
          {:else}
            <tr><td colspan="4" class="empty-note">{t(loading ? 'macro.readingShort' : 'macro.empty')}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="macro-side">
      <p class="field-label" id="macro-mode-label">{t('macro.repeat')}</p>
      <div class="seg" role="radiogroup" aria-labelledby="macro-mode-label">
        {#each ['times', 'untilKey', 'whileHeld'] as id (id)}
          <button type="button" role="radio" aria-checked={mode === id} onclick={() => (mode = id)}>{t(`macro.${id}`)}</button>
        {/each}
      </div>
      {#if mode === 'times'}
        <div class="power-row">
          <span><b>{t('macro.timesLabel')}</b><small>{t('macro.timesNote')}</small></span>
          <div class="mini-stepper">
            <button class="round" type="button" aria-label={t('macro.fewer')} disabled={loops <= 1} onclick={() => loops--}>−</button>
            <output class="num">{loops}</output>
            <button class="round" type="button" aria-label={t('macro.more')} disabled={loops >= 255} onclick={() => loops++}>+</button>
          </div>
        </div>
      {/if}
      <div class="macro-save">
        <button class="btn ghost" type="button" onclick={() => { stop(); onclose(); }}>{t('macro.cancel')}</button>
        <button class="btn primary" type="button" disabled={!events.length || recording || saving || loading || slots > max} onclick={save}>
          {t(saving ? 'macro.saving' : 'macro.save')}
        </button>
      </div>
    </div>
  </div>
</article>
