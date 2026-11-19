<script>
  // The first time a mouse is read in this browser: its shell, and how to show the DPI levels. Both stay in Settings.
  import { tick } from 'svelte';
  import { t } from '../i18n/index.svelte.js';
  import DpiPicker from './DpiPicker.svelte';
  import ShellPicker from './ShellPicker.svelte';
  import { setPref } from './prefs.svelte.js';
  import { view } from './view.svelte.js';

  let { markSrc } = $props();
  let go = $state();
  $effect(() => { if (view.welcome) tick().then(() => go?.focus({ preventScroll: true })); });
  // However it is closed, it has been seen.
  $effect(() => { if (!view.welcome) return; return () => setPref('firstRun', true); });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes it) -->
<div class="welcome" class:on={view.welcome} role="dialog" aria-modal="true" aria-labelledby="wtitle" aria-hidden={!view.welcome} tabindex="-1"
  onclick={e => { if (e.target === e.currentTarget) view.welcome = false; }}>
  <div class="wcard" role="document">
    <div class="wh"><img src={markSrc} alt=""><h2 class="disp" id="wtitle">{t('first.title')}</h2></div>
    <h3>{t('first.shell')}</h3><ShellPicker />
    <h3>{t('first.dpi')}</h3><DpiPicker />
    <p class="fine">{t('first.fine')}</p>
    <div class="wgo"><button class="btn go" type="button" bind:this={go} onclick={() => (view.welcome = false)}>{t('first.start')}</button></div>
  </div>
</div>
