<script>
  // On a phone the callouts don't fit round the mouse: its parts are a grid of tiles under the DPI levels instead.
  import { mouse } from '../device/mouse.svelte.js';
  import { t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';
  import { changedPart, says } from './says.js';
  import { studio } from './studio.svelte.js';
  import { LIST_ORDER, PARTS, openPart, view } from './view.svelte.js';

  const d = $derived(studio.draft);
</script>

<section class="plist" aria-label={t('parts.aria')}>
  {#each LIST_ORDER[view.face] as id (id)}
    {@const c = says(id, d)}
    <button class="prt" type="button" data-part={id} onclick={() => openPart(id)}>
      <span class="ic"><Icon name={PARTS[id].icon} /></span>
      <span>
        <small>{t(`part.${id}`)}</small>
        <b class="disp">{#if changedPart(id, d, mouse.profile)}<i class="mod"></i> {/if}{#if c.n != null}<span class="dot">{c.n}</span> {c.u}{:else}{c.v}{/if}</b>
        {#if c.sub}<span class="sub">{c.sub}</span>{/if}
      </span>
      <Icon name="chevron-right" />
    </button>
  {/each}
</section>
