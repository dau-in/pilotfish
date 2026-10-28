<script>
  // What each control does. A row's selector offers the firmware's functions, any key combination (captured from
  // the keyboard) and a macro; changes wait in the draft like everything else, macros are saved on their own.
  import { mouse } from '../device/mouse.svelte.js';
  import { t } from '../i18n/index.svelte.js';
  import MacroEditor from './MacroEditor.svelte';
  import MouseRender from './MouseRender.svelte';
  import { ACTIONS, FACTORY, actionLabel, buttonName, isListed, modsFromEvent, same, usageFromCode } from './shared.js';
  import { studio } from './studio.svelte.js';

  let { led } = $props();

  const buttons = $derived(studio.draft?.buttons);
  let picked = $state(null);
  let capturing = $state(null);  // button id waiting for a key combination
  let macroFor = $state(null);   // button id whose macro is open

  const onDevice = id => mouse.profile.buttons.find(b => b.id === id).raw;
  const isFactory = b => b.raw[0] === FACTORY[b.id] && !b.raw[1] && !b.raw[2];

  function choose(b, select) {
    const value = select.value;
    if (value === 'capture') { capturing = b.id; return; }
    // Opening the macro editor does not change the assignment yet: the selector goes back to what it was.
    if (value === 'macro') { macroFor = b.id; select.value = b.raw.join(','); return; }
    b.raw = value.split(',').map(Number);
  }

  // The next key pressed, with its modifiers, becomes the assignment. Esc cancels.
  function captureKey(e, b) {
    e.preventDefault();
    if (e.key === 'Escape') { capturing = null; return; }
    const usage = usageFromCode(e.code);
    if (!usage) { e.currentTarget.placeholder = t('buttons.badKey'); return; }
    b.raw = [17, modsFromEvent(e), usage];
    capturing = null;
  }
  const focus = node => node.focus();

  function factory() { for (const b of buttons) b.raw = [FACTORY[b.id], 0, 0]; }
</script>

<section class="screen buttons" aria-labelledby="title">
  <article class="panel button-map">
    <figure class="device">
      <MouseRender {led} markers {picked} alt={t('render.altButtons')} />
      <figcaption><span>{t('buttons.topView')}</span><span class="id">{t('buttons.dpiUnder')}</span></figcaption>
    </figure>
  </article>

  <article class="panel button-list">
    <div class="chart-head">
      <h2>{t('buttons.assignments')}</h2>
      <button class="btn ghost" type="button" disabled={!buttons} onclick={factory}>{t('buttons.factory')}</button>
    </div>
    <table class="assign">
      <thead><tr><th scope="col">{t('buttons.colControl')}</th><th scope="col">{t('buttons.colDoes')}</th><th scope="col" class="state-col">{t('buttons.colState')}</th></tr></thead>
      <tbody>
        {#if !buttons}
          <tr><td colspan="3" class="empty-note">{t('buttons.unread')}</td></tr>
        {:else}
          {#each buttons as b (b.id)}
            {@const value = b.raw.join(',')}
            <tr class:on={picked === b.id}
              onmouseenter={() => (picked = b.id)} onmouseleave={() => (picked = null)}
              onfocusin={() => (picked = b.id)} onfocusout={() => (picked = null)}>
              <td><span>{buttonName(b.id)}</span>{#if b.id === 'dpi'}<span class="note">{t('buttons.underneath')}</span>{/if}</td>
              <td>
                {#if capturing === b.id}
                  <input class="capture" readonly placeholder={t('buttons.capture')} aria-label={t('buttons.captureAria')}
                    use:focus onkeydown={e => captureKey(e, b)} onblur={() => (capturing = null)}>
                {:else}
                  <select aria-label={t('buttons.whatAria', { name: buttonName(b.id) })} {value} onchange={e => choose(b, e.currentTarget)}>
                    {#if !isListed(b.raw)}
                      <!-- A mapping that is not in the list (a custom combination, a macro) gets its own option. -->
                      <option value={value}>{actionLabel(b.raw)}</option>
                    {/if}
                    {#each ACTIONS as [group, items] (group)}
                      <optgroup label={t(`group.${group}`)}>
                        {#each items as a (a.key)}<option value={a.raw.join(',')}>{t(a.key)}</option>{/each}
                      </optgroup>
                    {/each}
                    <optgroup label={t('buttons.otherGroup')}>
                      <option value="capture">{t('buttons.otherCombo')}</option>
                      {#if mouse.maxMacroSteps}
                        <option value="macro">{t(b.raw[0] === 18 ? 'buttons.editMacro' : 'buttons.recordMacro')}</option>
                      {/if}
                    </optgroup>
                  </select>
                {/if}
              </td>
              <td>
                {#if !same(b.raw, onDevice(b.id))}<span class="pending-mark">{t('buttons.pending')}</span>
                {:else if isFactory(b)}{t('buttons.isFactory')}
                {:else}<span class="pill">{t('buttons.changed')}</span>{/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
    {#if !mouse.maxMacroSteps}
      <p class="hint">{t('buttons.macrosNeedUsb')}</p>
    {/if}
  </article>

  {#if macroFor}
    <MacroEditor button={buttons.find(b => b.id === macroFor)} onclose={() => (macroFor = null)} />
  {/if}
</section>
