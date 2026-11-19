<script>
  // The author's card, last in the settings: their picture, their name and their motto. The picture comes from
  // GitHub as it is, so it stays the author's own and changes when theirs does; without a connection the panel is a
  // blank page of screentone. The name, written once, is the signature.
  import { t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';

  const AVATAR = 'https://avatars.githubusercontent.com/u/259484817?v=4&s=480';
  // The motto, in Japanese as the author writes it; t('credits.motto') carries its meaning for the screen reader.
  const MOTTO = ['全ての存在は滅びるように', 'デザインされている。'];
  let failed = $state(false);
</script>

<a class="cr" href="https://github.com/dau-in" target="_blank" rel="noopener" aria-label={t('credits.aria')}>
  <span class="ph"><span class="frame"><span class="panel" class:noimg={failed}><img src={AVATAR} alt="" crossorigin="anonymous" onerror={() => (failed = true)}><i class="tint"></i></span></span></span>
  <span class="who">
    <span class="sig"><span class="nm">𝓓`</span><i class="led"></i></span>
    <span class="jp" lang="ja" title={t('credits.motto')}>{#each MOTTO as line (line)}<span>{line}</span>{/each}</span>
  </span>
  <span class="lnk">
    <span class="gh"><Icon name="github" /><span class="url"><span class="host">github.com/</span><span class="handle">dau-in</span></span></span>
    <svg class="go" viewBox="0 0 26 12" aria-hidden="true"><path d="M1 6H23M18 1.5L23.5 6L18 10.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </span>
</a>
