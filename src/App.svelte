<script>
  import { onMount, untrack } from 'svelte';
  import { autoConnect, mouse } from './lib/device/mouse.svelte.js';
  import { t } from './lib/i18n/index.svelte.js';
  import { dataUrl, glyph, tile } from './lib/art/mark.js';
  import Band from './lib/ui/Band.svelte';
  import BluetoothGuide from './lib/ui/BluetoothGuide.svelte';
  import Drawer from './lib/ui/Drawer.svelte';
  import FirstRun from './lib/ui/FirstRun.svelte';
  import Header from './lib/ui/Header.svelte';
  import PartList from './lib/ui/PartList.svelte';
  import Stage from './lib/ui/Stage.svelte';
  import { note } from './lib/ui/battery.svelte.js';
  import { prefs } from './lib/ui/prefs.svelte.js';
  import { lightKind, ledColor, ownColor } from './lib/ui/shared.js';
  import { apply, follow, isDirty, studio, undo } from './lib/ui/studio.svelte.js';
  import { closeCard, narrow, view } from './lib/ui/view.svelte.js';

  const ready = $derived(mouse.status === 'ready' && Boolean(studio.draft));
  const d = $derived(ready ? studio.draft : null);

  // The draft follows every new read of the mouse. Only the profile is tracked: follow() reads and writes the draft,
  // and tracking those too made the effect re-run itself until the page froze.
  $effect(() => {
    const profile = mouse.profile;
    untrack(() => follow(profile, t('profile.first')));
  });
  $effect(() => { note(mouse.battery); });
  // The first time a mouse is read in this browser: its shell, and how to show the DPI levels.
  $effect(() => { if (ready && !untrack(() => prefs.firstRun)) view.welcome = true; });
  // Without a mouse there is nothing to open.
  $effect(() => { if (!ready) untrack(() => { view.open = null; view.testing = false; view.pop = null; }); });

  /* ---------- The look follows the device: the level's colour, the light's effect, its brightness ---------- */
  const level = $derived(d ? d.levels[d.activeLevel - 1].color : '#ff0000');
  $effect(() => {
    const root = document.documentElement, L = d?.lighting;
    root.dataset.theme = prefs.theme;
    root.style.setProperty('--level', level);
    root.style.setProperty('--led', L && ownColor(L.mode) ? L.color : level);
    root.classList.toggle('neon', L?.mode === 3 || L?.mode === 4);
    root.style.setProperty('--bright', L ? (0.32 + 0.68 * (L.brightness - 1) / 7).toFixed(3) : '.9');
    root.style.setProperty('--period', L ? `${(6.2 - (L.speed - 1) * 0.66).toFixed(2)}s` : '3s');
    document.querySelector('link[rel="icon"]')?.setAttribute('href', dataUrl(tile(level)));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--ground').trim() || '#171719');
  });
  const light = $derived(d ? lightKind(d.lighting.mode) : 'off');
  const led = $derived(ledColor(d));
  const markSrc = $derived(dataUrl(glyph(level, prefs.theme === 'light' ? '#24211e' : '#ececec')));

  // In Test the side buttons must not take the page back: the history gets a step of its own to spend.
  $effect(() => {
    if (!view.testing) return;
    history.pushState({ test: 1 }, '');
    const stay = () => history.pushState({ test: 1 }, '');
    addEventListener('popstate', stay);
    return () => removeEventListener('popstate', stay);
  });

  onMount(() => {
    const typing = el => el?.matches?.('input, textarea, select, [contenteditable]');
    const onKey = e => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (view.welcome) view.welcome = false;
        else if (view.btGuide) view.btGuide = false;
        else if (view.drawer) view.drawer = null;
        else if (view.pop) view.pop = null;
        else if (view.open) closeCard();
        else if (view.testing) view.testing = false;
        return;
      }
      if (typing(document.activeElement)) return;
      if (e.key === 'Enter' && e.ctrlKey && isDirty()) { e.preventDefault(); apply(); }
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && studio.undo) { e.preventDefault(); undo(); }
    };
    // The browser's own menu has nothing for a tool like this, and the right button is one of the mouse's buttons
    // to try out; fields keep theirs, for pasting.
    const onMenu = e => { if (!typing(e.target)) e.preventDefault(); };
    // Leaving with changes not applied, or in the middle of writing one, asks first.
    const onLeave = e => { if (studio.busy || (ready && isDirty())) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('keydown', onKey);
    addEventListener('contextmenu', onMenu);
    addEventListener('beforeunload', onLeave);
    autoConnect();
    return () => { removeEventListener('keydown', onKey); removeEventListener('contextmenu', onMenu); removeEventListener('beforeunload', onLeave); };
  });
</script>

<div class="app" class:testing={view.testing}>
  <Header {markSrc} {ready} />
  <Stage {ready} {light} {led} />
  <Band {ready} />
  {#if ready}<PartList />{/if}
</div>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes them) -->
<div class="scrim" class:on={view.drawer || (view.open && ready && narrow.current)} onclick={() => { if (view.drawer) view.drawer = null; else closeCard(); }}></div>
<Drawer {ready} />
{#if ready}<FirstRun {markSrc} />{:else}<BluetoothGuide />{/if}
