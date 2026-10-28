<script>
  // Shown while no X11 is connected: there is nothing to configure without the mouse, so this only says how to
  // connect it. After the first time, the cable and the receiver are found on their own.
  import { connectBluetooth, connectUsb, mouse, support } from '../device/mouse.svelte.js';
  import { errorText, t } from '../i18n/index.svelte.js';
  import MouseRender from './MouseRender.svelte';

  let busy = $state(false);
  let error = $state(null);

  async function go(connect) {
    busy = true;
    error = null;
    try { await connect(); } catch (err) {
      // Closing the browser's chooser is not an error worth showing.
      if (err.name !== 'NotFoundError') error = err;
    } finally {
      busy = false;
    }
  }
  const unsupported = !support.hid && !support.bluetooth;
</script>

<main class="welcome">
  <div class="welcome-copy">
    <h1>{t('app.name')}</h1>
    <p class="lede">{t('app.tagline')}</p>

    {#if unsupported}
      <p class="notice">{t('welcome.unsupported')}</p>
    {:else}
      <ol class="steps">
        <li>
          <b>{t('welcome.cableTitle')}</b>
          <span>{t('welcome.cableBody')}</span>
          <button class="btn primary" type="button" disabled={busy || !support.hid} onclick={() => go(connectUsb)}>{t('welcome.cableButton')}</button>
        </li>
        <li>
          <b>{t('welcome.btTitle')}</b>
          <span>{t('welcome.btBody')}</span>
          <button class="btn" type="button" disabled={busy || !support.bluetooth} onclick={() => go(connectBluetooth)}>{t('welcome.btButton')}</button>
        </li>
      </ol>
      {#if mouse.status === 'connecting'}<p class="hint">{t(mouse.asleep ? 'welcome.asleep' : 'welcome.reading')}</p>{/if}
      {#if error || mouse.error}<p class="hint error">{t('welcome.failed', { msg: errorText(error ?? mouse.error) })}</p>{/if}
    {/if}
    <p class="hint">{t('welcome.safety')}</p>
  </div>
  <figure class="device welcome-shot">
    <MouseRender led="#2a2a2e" />
  </figure>
</main>
