<script>
  // What a button does: one of the common actions, a key or combination pressed on the keyboard, or a macro.
  import { onDestroy } from 'svelte';
  import { mouse } from '../device/mouse.svelte.js';
  import { t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';
  import MacroEditor from './MacroEditor.svelte';
  import { ACTIONS, FACTORY, actionLabel, groupOf, iconOf, keyLabel, modsFromEvent, same, usageFromCode } from './shared.js';
  import { studio } from './studio.svelte.js';
  import { PARTS, view } from './view.svelte.js';

  let { part, close } = $props();

  const d = $derived(studio.draft);
  const slot = $derived(part === 'wheel' ? view.open.sub : part);
  const own = $derived(d.buttons?.find(b => b.id === slot));
  const was = $derived(mouse.profile.buttons?.find(b => b.id === slot));
  let editor = $state(null); // combo | macro
  let warn = $state(false);
  let group = $state(null);
  const shownGroup = $derived(group ?? groupOf(own?.raw ?? []) ?? 'mouse');
  const where = $derived(part === 'dpi' ? t('buttons.whereDpi') : part === 'forward' || part === 'back' ? t('buttons.whereSide') : '');
  const isCombo = $derived(own?.raw[0] === 17);
  const isMacro = $derived(own?.raw[0] === 18);
  const macrosHere = $derived(mouse.kind !== 'bluetooth');

  function assign(raw) {
    // The mouse refuses a mapping with no left click; say so here, before anything is sent.
    const next = d.buttons.map(b => (b.id === slot ? raw : b.raw));
    if (!next.some(r => r[0] === 2)) { warn = true; return; }
    warn = false;
    own.raw = [...raw];
  }
  function setSub(s) { view.open.sub = s; editor = null; warn = false; group = null; stopCapture(); }

  /* ---------- Key or combination: pressed on the keyboard, not built from lists ---------- */
  let combo = $state(null); // { mods, usage }
  const MOD_NAMES = [[1, 'Ctrl'], [2, 'Shift'], [4, 'Alt'], [8, 'Win']];
  const comboKeys = c => (c ? [...MOD_NAMES.filter(([bit]) => c.mods & bit).map(([, n]) => n), c.usage ? keyLabel(c.usage) : null].filter(Boolean) : []);
  const MODIFIER = /^(Control|Shift|Alt|Meta)(Left|Right)$/;
  function onComboKey(e) {
    e.preventDefault(); e.stopPropagation();
    if (e.type !== 'keydown') return;
    if (e.key === 'Escape') { editor = null; stopCapture(); return; }
    const mods = modsFromEvent(e), usage = MODIFIER.test(e.code) ? null : usageFromCode(e.code);
    if (usage) combo = { mods, usage };
    else if (!combo?.usage || MODIFIER.test(e.code)) combo = { mods, usage: null };
  }
  function startCapture() {
    editor = 'combo'; combo = null;
    addEventListener('keydown', onComboKey, true);
  }
  function stopCapture() { removeEventListener('keydown', onComboKey, true); }
  onDestroy(stopCapture);
  function useCombo() { assign([17, combo.mods, combo.usage]); editor = null; stopCapture(); }
</script>

<header class="ehead">
  <span class="ic"><Icon name={PARTS[part].icon} /></span>
  <div><h3 class="disp">{t(`part.${part}`)}</h3>{#if where}<p>{where}</p>{/if}</div>
  <button class="iconbtn x" type="button" data-close aria-label={t('card.close', { name: t(`part.${part}`) })} onclick={close}><Icon name="close" /></button>
</header>
{#if !own}
  <p class="lede">{t('buttons.unread')}</p>
{:else}
  <p class="lede">{@html t('buttons.now', { now: actionLabel(own.raw), was: !same(own.raw, was?.raw) && was && actionLabel(was.raw) })}</p>
  {#if part === 'wheel'}
    <div class="seg inset" role="radiogroup" aria-label={t('buttons.wheelPart')} style:margin="-4px 0 12px -12px">
      {#each [['wheel', 'buttons.click'], ['wheel-up', 'buttons.up'], ['wheel-down', 'buttons.down']] as [s, k] (s)}
        <button type="button" role="radio" aria-checked={view.open.sub === s} onclick={() => setSub(s)}>{t(k)}</button>
      {/each}
    </div>
  {/if}
  {#if editor === 'combo'}
    {@const keys = comboKeys(combo)}
    <p class="grp">{t('buttons.combo')}</p>
    <div class="capture" class:done={combo?.usage} role="status">
      {#if keys.length}
        {#each keys as k, i (i)}{#if i}<span class="plus">+</span>{/if}<kbd>{k}</kbd>{/each}
      {:else}<span class="wait">{t('buttons.pressKeys')}</span>{/if}
    </div>
    <p class="fine">{t('buttons.comboNote')}</p>
    <div class="efoot">
      <button class="btn" type="button" onclick={() => { editor = null; stopCapture(); }}>{t('action.cancel')}</button>
      <button class="btn go" type="button" disabled={!combo?.usage} onclick={useCombo}>{combo?.usage ? t('buttons.use', { combo: keys.join(' + ') }) : t('buttons.useIt')}</button>
    </div>
  {:else if editor === 'macro'}
    <MacroEditor button={own} onclose={() => (editor = null)} />
  {:else}
    {#if warn}<p class="warn">{t('buttons.needLeft')}</p>{/if}
    <div class="tiles">
      <button class="tile" type="button" aria-pressed={isCombo} onclick={startCapture}>
        <Icon name="keyboard" /><span>{t('buttons.combo')}</span><small>{isCombo ? actionLabel(own.raw) : t('buttons.comboHint')}</small>
      </button>
      <button class="tile" type="button" aria-pressed={isMacro} disabled={!macrosHere} title={macrosHere ? undefined : t('buttons.macrosNeedUsb')} onclick={() => (editor = 'macro')}>
        <Icon name="script-text" /><span>{t('act.macro')}</span><small>{macrosHere ? (isMacro ? t('buttons.macroSaved') : t('buttons.macroHint')) : t('buttons.macroUsb')}</small>
      </button>
    </div>
    <p class="grp">{t('buttons.orThese')}</p>
    <div class="seg tight inset" role="tablist" aria-label={t('buttons.kinds')}>
      {#each ACTIONS as [g] (g)}
        <button type="button" role="tab" aria-selected={g === shownGroup} onclick={() => (group = g)}>{t(`group.${g}`)}</button>
      {/each}
    </div>
    <div class="chips" style:margin-top="10px">
      {#each ACTIONS.find(([g]) => g === shownGroup)[1] as a (a.key)}
        <button class="chip" type="button" aria-pressed={same(own.raw, a.raw)} onclick={() => assign(a.raw)}><Icon name={iconOf(a.raw)} />{t(a.key)}</button>
      {/each}
    </div>
    {#if !same(own.raw, [FACTORY[slot], 0, 0])}
      <p class="fine"><button class="link" type="button" onclick={() => assign([FACTORY[slot], 0, 0])}>{t('buttons.backTo', { action: actionLabel([FACTORY[slot], 0, 0]) })}</button>{t('buttons.fromFactory')}</p>
    {/if}
  {/if}
{/if}
