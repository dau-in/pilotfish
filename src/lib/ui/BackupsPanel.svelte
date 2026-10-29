<script>
  // The backup timeline, newest first. Each entry's dot is the LED colour of the DPI level it had active, so a
  // setup can be told apart at a glance the same way the mouse tells its levels apart.
  import bookmarkIcon from 'pixelarticons/svg/bookmark.svg';
  import { mouse } from '../device/mouse.svelte.js';
  import { backups, exportAll, importFile, keep, remember } from '../backup/backups.svelte.js';
  import { differences, settingsOf } from '../backup/format.js';
  import { clock, fmt, locale, t } from '../i18n/index.svelte.js';
  import { isDirty, restore, studio } from './studio.svelte.js';

  const SHOWN = 6;
  let all = $state(false);
  let note = $state('');
  let picker;

  const maskOf = icon => `url(${JSON.stringify(icon)})`;
  const now = $derived(mouse.profile && settingsOf(mouse.profile));
  const newest = $derived([...backups.list].reverse());
  const shown = $derived(all ? newest : newest.slice(0, SHOWN));
  // Only the newest backup equal to the mouse is "current"; older equal ones just say so.
  const current = $derived(now && newest.find(b => !differences(b.settings, now).length)?.id);
  const saved = $derived(backups.list.filter(b => ['saved', 'restored', 'undone'].includes(b.reason)).length);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const day = (d, year) => d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', ...(year && { year: 'numeric' }) });
  function when(at) {
    const d = new Date(at);
    if (sameDay(d, new Date())) return clock(d);
    return `${day(d, d.getFullYear() !== new Date().getFullYear())}, ${clock(d)}`;
  }
  const list = items => new Intl.ListFormat(locale(), { type: 'conjunction' }).format(items);
  const diffText = b => {
    const areas = now ? differences(b.settings, now) : [];
    return areas.length ? t('backup.differs', { areas: list(areas.map(a => t(`backup.area.${a}`))) }) : t('backup.same');
  };
  const dot = b => b.settings.dpi.levels[b.settings.dpi.activeLevel - 1]?.color ?? 'var(--bar)';
  const reason = b => t(b.first ? 'backup.reason.first' : `backup.reason.${b.reason}`);

  async function snap() {
    await remember(mouse.profile, 'manual');
    note = t('backup.snapped');
  }
  async function onFile(e) {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    const n = await importFile(file);
    note = n === null ? t('backup.badFile') : t('backup.imported', { n });
  }
</script>

<div class="setting">
  <div class="s-label">
    <h2>{t('backup.title')}</h2>
    <p>{t('backup.body')}</p>
  </div>
  <div class="s-panel backups">
    <dl class="bk-stats">
      <div><dt>{t('backup.statCount')}</dt><dd class="num">{fmt(backups.list.length)}</dd></div>
      <div><dt>{t('backup.statSince')}</dt><dd>{backups.list.length ? day(new Date(backups.list[0].at), true) : '—'}</dd></div>
      <div><dt>{t('backup.statSaved')}</dt><dd class="num">{fmt(saved)}</dd></div>
    </dl>
    <p class="hint" class:warn={!backups.persisted}>
      {backups.failed ? t('backup.noStorage') : backups.persisted ? t('backup.safe') : t('backup.unsafe')}
    </p>

    {#if backups.loaded && !backups.list.length}
      <p class="bk-empty">{t('backup.empty')}</p>
    {:else}
      <ol class="timeline">
        {#each shown as b (b.id)}
          {@const isCurrent = b.id === current}
          {@const same = now && !differences(b.settings, now).length}
          <li class="bk" class:current={isCurrent}>
            <i class="bk-dot" style:--c={dot(b)} aria-hidden="true"></i>
            <div class="bk-text">
              <p><b>{reason(b)}</b><time datetime={new Date(b.at).toISOString()}>{when(b.at)}</time>{#if isCurrent}<span class="pill">{t('backup.now')}</span>{/if}</p>
              <small>{isCurrent ? t('backup.isNow') : diffText(b)}</small>
            </div>
            <button class="bk-keep" type="button" aria-pressed={b.kept} disabled={b.first}
              title={b.first ? t('backup.firstKept') : b.kept ? t('backup.kept') : t('backup.keep')}
              aria-label={b.kept ? t('backup.kept') : t('backup.keep')} onclick={() => keep(b, !b.kept)}>
              <i class="ic" style:--i={maskOf(bookmarkIcon)}></i>
            </button>
            <button class="btn" type="button" title={isDirty() ? t('backup.editsFirst') : t('backup.restoreTitle')}
              disabled={same || studio.busy || isDirty()} onclick={() => restore(b.settings)}>{t('backup.restore')}</button>
          </li>
        {/each}
      </ol>
      {#if newest.length > SHOWN}
        <button class="btn ghost bk-more" type="button" onclick={() => (all = !all)}>
          {all ? t('backup.showFewer') : t('backup.showAll', { n: fmt(newest.length) })}
        </button>
      {/if}
    {/if}

    <div class="bk-actions">
      <button class="btn" type="button" disabled={backups.failed || !mouse.profile} onclick={snap}>{t('backup.snap')}</button>
      <button class="btn ghost" type="button" disabled={!backups.list.length} onclick={exportAll}>{t('backup.export')}</button>
      <button class="btn ghost" type="button" disabled={backups.failed} onclick={() => picker.click()}>{t('backup.import')}</button>
      <input bind:this={picker} type="file" accept="application/json,.json" hidden onchange={onFile}>
    </div>
    <p class="hint" aria-live="polite">{note}</p>
  </div>
</div>

<style>
  .bk-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 4px 0 12px; }
  .bk-stats dt { color: var(--muted); font-size: var(--fs-small); }
  .bk-stats dd { margin-top: 2px; font-size: var(--fs-kpi); line-height: 28px; font-weight: 500; }
  .warn { color: var(--text); }
  .bk-empty { padding: 16px 0; color: var(--muted); }

  /* A vertical thread through the dots: the setups follow one another. */
  .timeline { position: relative; list-style: none; margin: 16px 0 0; padding: 0; }
  .timeline::before { content: ""; position: absolute; left: 4px; top: 20px; bottom: 20px; width: 1px; background: var(--control); }
  .bk { position: relative; display: grid; grid-template-columns: 9px minmax(0, 1fr) auto auto; align-items: center; gap: 16px; padding: 10px 0; }
  .bk + .bk { border-top: 1px solid var(--rule); }
  .bk-dot { width: 9px; height: 9px; border-radius: 2px; background: var(--c); box-shadow: 0 0 0 3px var(--surface); }
  .bk.current .bk-dot { box-shadow: 0 0 0 3px var(--surface), 0 0 10px 1px var(--c); }
  .bk-text p { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .bk-text b { font-weight: 500; font-size: 14px; }
  .bk-text time { color: var(--muted); font-size: var(--fs-small); font-variant-numeric: tabular-nums; }
  .bk-text small { display: block; margin-top: 2px; color: var(--muted); font-size: var(--fs-small); }
  .bk .pill { background: var(--pill-neutral-bg); color: var(--pill-neutral-ink); }

  .bk-keep { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%;
    background: transparent; color: var(--control); cursor: pointer; transition: color var(--t-hover) ease; }
  .bk-keep:hover { color: var(--muted); }
  .bk-keep[aria-pressed="true"] { color: var(--text); }
  .bk-keep:disabled { cursor: default; }
  .bk-keep:focus-visible { outline: 1px solid var(--text); outline-offset: 2px; }
  .bk-more { margin-top: 4px; padding: 0; }

  .bk-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--rule); }

  @media (max-width: 560px) {
    .bk { grid-template-columns: 9px minmax(0, 1fr) auto; }
    .bk .btn { grid-column: 2 / -1; justify-self: start; }
  }
</style>
