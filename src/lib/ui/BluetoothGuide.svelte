<script>
  // Connecting over Bluetooth takes a few steps the browser and the system don't explain, and the system's own offer
  // to connect gets in the way. This sheet says them before the browser's list opens.
  import { tick } from 'svelte';
  import { connectBluetooth } from '../device/mouse.svelte.js';
  import { errorText, t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';
  import { view } from './view.svelte.js';

  let busy = $state(false), error = $state(null), go = $state();
  $effect(() => { if (view.btGuide) { error = null; tick().then(() => go?.focus({ preventScroll: true })); } });

  async function choose() {
    busy = true; error = null;
    try {
      await connectBluetooth();
      view.btGuide = false;
    } catch (err) {
      // Closing the browser's list is not an error worth showing.
      if (err.name !== 'NotFoundError') error = err;
    } finally { busy = false; }
  }
  const STEPS = ['bt.step1', 'bt.step2', 'bt.step3'];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes it) -->
<div class="welcome" class:on={view.btGuide} role="dialog" aria-modal="true" aria-labelledby="bttitle" aria-hidden={!view.btGuide} tabindex="-1"
  onclick={e => { if (e.target === e.currentTarget && !busy) view.btGuide = false; }}>
  <div class="wcard btguide" role="document">
    <div class="wh"><span class="btmark"><Icon name="radio-signal" /></span><h2 class="disp" id="bttitle">{t('bt.title')}</h2></div>
    <ol class="steps">
      {#each STEPS as key, i (key)}
        <li><span class="n dot s10">{i + 1}</span><span>{@html t(key)}</span></li>
      {/each}
    </ol>
    <p class="fine">{t('bt.missing')}</p>
    <p class="fine">{t('bt.everyTime')}</p>
    {#if error}<p class="warn" role="alert">{t('welcome.failed', { msg: errorText(error) })}</p>{/if}
    <div class="wgo">
      <button class="btn" type="button" disabled={busy} onclick={() => (view.btGuide = false)}>{t('action.cancel')}</button>
      <button class="btn go" type="button" bind:this={go} disabled={busy} onclick={choose}>{t('bt.choose')}</button>
    </div>
  </div>
</div>
