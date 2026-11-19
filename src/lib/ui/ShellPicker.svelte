<script>
  // The colour of the user's X11, each shown as a small picture of the shell.
  import { X11 } from '../art/x11.js';
  import { t } from '../i18n/index.svelte.js';
  import { SHELLS, prefs, setPref } from './prefs.svelte.js';
</script>

<div class="shells" role="group" aria-label={t('device.shell')}>
  {#each SHELLS as s (s)}
    {@const c = X11.SHELLS[s]}
    <button type="button" aria-pressed={prefs.shell === s} onclick={() => setPref('shell', s)}>
      <svg viewBox="0 0 760 1523" aria-hidden="true"><path d={X11.BODY} fill={c.base} stroke={c.ink} stroke-width="18" /><path d={X11.LEFT} fill="none" stroke={c.seam} stroke-width="14" /><path d={X11.RIGHT} fill="none" stroke={c.seam} stroke-width="14" /></svg>{t(`shell.${s}`)}
    </button>
  {/each}
</div>
