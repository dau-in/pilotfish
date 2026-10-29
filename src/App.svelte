<script>
  import { onMount, untrack } from 'svelte';
  import gamepadIcon from 'pixelarticons/svg/gamepad.svg';
  import mouseIcon from 'pixelarticons/svg/mouse.svg';
  import reloadIcon from 'pixelarticons/svg/reload.svg';
  import slidersIcon from 'pixelarticons/svg/sliders.svg';
  import { autoConnect, disconnect, mouse } from './lib/device/mouse.svelte.js';
  import { t } from './lib/i18n/index.svelte.js';
  import ButtonsScreen from './lib/ui/ButtonsScreen.svelte';
  import MouseScreen from './lib/ui/MouseScreen.svelte';
  import SettingsScreen from './lib/ui/SettingsScreen.svelte';
  import Welcome from './lib/ui/Welcome.svelte';
  import {
    LIGHT, LOW_BATTERY, NATIVE_MAX, actionLabel, batteryText, buttonName, fmt, isDoubled, linkName,
  } from './lib/ui/shared.js';
  import { apply, discard, follow, isDirty, stampText, studio, undo } from './lib/ui/studio.svelte.js';

  const PAGES = ['mouse', 'buttons', 'settings'];
  const NAV = [
    { id: 'mouse', icon: mouseIcon },
    { id: 'buttons', icon: gamepadIcon },
    { id: 'settings', icon: slidersIcon },
  ];
  // Vite inlines the small SVGs as data URIs, which only survive inside url() when quoted.
  const maskOf = icon => `url(${JSON.stringify(icon)})`;
  const fromHash = () => (PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'mouse');
  let page = $state(fromHash());

  onMount(() => {
    const onHash = () => (page = fromHash());
    addEventListener('hashchange', onHash);
    const typing = el => el?.matches?.('input, textarea, select, [contenteditable]');
    const onKey = e => {
      if (e.key === 'Enter' && e.ctrlKey) apply();
      // Ctrl+Z inside a field is the field's own undo.
      if (e.key.toLowerCase() === 'z' && e.ctrlKey && !e.shiftKey && !typing(document.activeElement) && studio.undo) {
        e.preventDefault();
        undo();
      }
    };
    addEventListener('keydown', onKey);
    autoConnect();
    return () => { removeEventListener('hashchange', onHash); removeEventListener('keydown', onKey); };
  });

  // The draft follows every new read of the mouse. Only the profile is tracked: follow() reads and writes the
  // draft and the stamp, and tracking those too made the effect re-run itself until the page froze.
  $effect(() => {
    const profile = mouse.profile;
    untrack(() => follow(profile));
  });

  const ready = $derived(mouse.status === 'ready' && studio.draft);
  const d = $derived(studio.draft);
  const active = $derived(d?.levels[d.activeLevel - 1]);
  // The app's one accent is the colour of the DPI level in use, read from the mouse.
  $effect(() => { if (active) document.documentElement.style.setProperty('--accent', active.color); });
  // The render's LED shows what the real one shows: off, the light colour, or the DPI colour.
  const led = $derived(!d ? '#2a2a2e' : d.lighting.mode === 0 ? '#2a2a2e' : LIGHT[d.lighting.mode]?.color ? d.lighting.color : active.color);

  const battery = $derived(batteryText(mouse.battery));
  const low = $derived(mouse.battery?.state === 'battery' && mouse.battery.level <= LOW_BATTERY ? mouse.battery.level : 0);

  // The finding under the title, computed from what the screen shows.
  const finding = $derived.by(() => {
    if (!d) return '';
    if (page === 'buttons') {
      const buttons = mouse.profile?.buttons;
      if (!buttons) return t('finding.buttonsUnread');
      const items = buttons.filter(b => !b.factory).map(b => [buttonName(b.id), actionLabel(b.raw)]);
      return items.length
        ? t('finding.buttonsChanged', { total: buttons.length, items })
        : t('finding.buttonsFactory', { total: buttons.length });
    }
    if (page === 'settings') {
      return t('finding.settings', { hz: mouse.canChangePolling && d.pollingHz, snap: d.angleSnap, ripple: d.ripple });
    }
    const doubled = d.levels.map((l, i) => ({ ...l, n: i + 1 })).filter(l => isDoubled(l.dpi));
    return doubled.length
      ? t('finding.doubled', {
        list: doubled.map(l => `${t('dpi.short', { n: l.n })} (${fmt(l.dpi)})`).join(', '),
        many: doubled.length > 1,
        max: fmt(NATIVE_MAX),
      })
      : t('finding.native', { max: fmt(NATIVE_MAX) });
  });

  async function reread() {
    // Disconnecting and finding it again re-reads everything (version included).
    await disconnect();
    await autoConnect();
  }
</script>

{#if !ready}
  <Welcome />
{:else}
  <div class="app" data-online="true">
    <nav class="rail" aria-label={t('nav.sections')}>
      <a class="mark" href="#mouse" aria-label={t('app.name')}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M20 44c6-4 9-14 9-27 7 6 13 16 15 27z" fill="currentColor" />
          <rect class="mark-led" x="28" y="49" width="8" height="2.6" rx="1.3" />
        </svg>
      </a>
      {#each NAV as n (n.id)}
        <a class="rail-item" href="#{n.id}" title={t(`nav.${n.id}`)} aria-current={page === n.id ? 'page' : undefined}>
          <i class="ic" style:--i={maskOf(n.icon)}></i><span>{t(`nav.${n.id}`)}</span>
        </a>
      {/each}
      <button class="rail-item util" type="button" title={t('nav.rereadTitle')} onclick={reread}>
        <i class="ic" style:--i={maskOf(reloadIcon)}></i><span>{t('nav.reread')}</span>
      </button>
    </nav>

    <main class="canvas">
      <header class="title-row">
        <div>
          <h1 id="title">{t(`page.${page}`)}</h1>
          <p class="sub">
            {#if page === 'mouse'}{t('header.level', { n: d.activeLevel })} <b>{fmt(active.dpi)} dpi</b>.{' '}{/if}{finding}
            {#if low}{' '}<b>{t('battery.low', { level: low })}</b>{/if}
          </p>
        </div>
        <div class="title-actions">
          <p class="link-state"><span>{linkName(mouse.kind)}</span>{#if mouse.asleep}<span>{t('battery.asleep')}</span>{:else if battery}<span class:low>{battery}</span>{/if}</p>
          <p class="stamp" class:error={studio.stamp.err}>{stampText(studio.stamp)}</p>
          {#if studio.undo && !isDirty() && !studio.busy}
            <button class="btn ghost" type="button" title={t('action.undoTitle')} onclick={() => undo()}>{t('action.undo')}</button>
          {/if}
          {#if isDirty()}
            <div class="pending">
              <button class="btn ghost" type="button" onclick={discard}>{t('action.discard')}</button>
              <button class="btn primary" type="button" disabled={studio.busy} onclick={() => apply()}>{t('action.apply')}</button>
            </div>
          {/if}
        </div>
      </header>

      {#if page === 'mouse'}<MouseScreen {led} />
      {:else if page === 'buttons'}<ButtonsScreen {led} />
      {:else}<SettingsScreen />{/if}
    </main>
  </div>
{/if}
