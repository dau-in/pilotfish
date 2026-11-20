<script>
  // The drawers: History, every setup the mouse has had, and Settings, with the credits last.
  import { tick } from 'svelte';
  import { mouse } from '../device/mouse.svelte.js';
  import { backups, exportAll, importFile } from '../backup/backups.svelte.js';
  import { differences, draftFrom, settingsOf } from '../backup/format.js';
  import { LANGS, clock, fmt, i18n, locale, setLang, t } from '../i18n/index.svelte.js';
  import Credits from './Credits.svelte';
  import ReportActions from './ReportActions.svelte';
  import DpiPicker from './DpiPicker.svelte';
  import Icon from './Icon.svelte';
  import ShellPicker from './ShellPicker.svelte';
  import { THEMES, prefs, setPref } from './prefs.svelte.js';
  import { profiles } from './profiles.svelte.js';
  import { actionLabel, same } from './shared.js';
  import { isDirty, studio } from './studio.svelte.js';
  import { view } from './view.svelte.js';

  let { ready } = $props();
  let el = $state(), from = null, note = $state(''), picker = $state();

  // Focus goes into the drawer as it opens and back where it came from as it closes.
  $effect(() => {
    if (view.drawer) { from = document.activeElement; note = ''; tick().then(() => el?.querySelector('[data-close]')?.focus()); }
    else from?.focus?.();
  });
  const close = () => { view.drawer = null; };

  /* ---------- History ---------- */
  const now = $derived(mouse.profile && settingsOf(mouse.profile));
  const newest = $derived([...backups.list].reverse());
  // Only the newest backup equal to the mouse is "on the mouse".
  const current = $derived(now && newest.find(b => !differences(b.settings, now).length)?.id);
  const when = at => {
    const d = new Date(at), today = new Date();
    if (d.toDateString() === today.toDateString()) return t('history.today', { time: clock(d) });
    return `${d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' }) })}, ${clock(d)}`;
  };
  // What changed from one setup to the next, as lines: a name, what it was and what it became.
  function describe(a, b) {
    if (!a) return [{ k: t('backup.reason.first') }];
    const out = [], ch = (k, x, y) => out.push({ k, a: x, b: y });
    b.dpi.levels.forEach((l, i) => {
      const p = a.dpi.levels[i]; if (!p) return;
      if (p.dpi !== l.dpi) ch(t('dpi.level', { n: i + 1 }), fmt(p.dpi), fmt(l.dpi));
      else if (p.color !== l.color) out.push({ k: t('history.levelColor', { n: i + 1 }) });
    });
    if (a.buttons && b.buttons) for (const id of Object.keys(b.buttons)) if (!same(a.buttons[id], b.buttons[id])) ch(t(`button.${id}`), actionLabel(a.buttons[id]), actionLabel(b.buttons[id]));
    if (a.light.mode !== b.light.mode) ch(t('part.led'), t(`lightMode.${a.light.mode}`), t(`lightMode.${b.light.mode}`));
    else if (!same(a.light, b.light)) out.push({ k: t('part.led') });
    if (a.polling != null && b.polling != null && a.polling !== b.polling) ch(t('polling.title'), `${a.polling} Hz`, `${b.polling} Hz`);
    if (a.power.sleepMinutes !== b.power.sleepMinutes) ch(t('power.sleep'), `${a.power.sleepMinutes} min`, `${b.power.sleepMinutes} min`);
    if (a.power.keyResponseMs !== b.power.keyResponseMs) ch(t('power.response'), `${a.power.keyResponseMs} ms`, `${b.power.keyResponseMs} ms`);
    if (a.dpi.angleSnap !== b.dpi.angleSnap) ch(t('sensor.snap'), t(a.dpi.angleSnap ? 'card.on' : 'card.off'), t(b.dpi.angleSnap ? 'card.on' : 'card.off'));
    if (a.dpi.ripple !== b.dpi.ripple) ch(t('sensor.ripple'), t(a.dpi.ripple ? 'card.on' : 'card.off'), t(b.dpi.ripple ? 'card.on' : 'card.off'));
    return out.length ? out : [{ k: t('history.same') }];
  }
  const dot = b => b.settings.dpi.levels[b.settings.dpi.activeLevel - 1]?.color ?? 'var(--muted)';
  const reason = b => t(b.first ? 'history.firstKept' : `backup.reason.${b.reason}`);
  // Going back puts that setup in the draft, to look over before applying, as any other edit.
  function goBack(b) {
    if (!mouse.profile || studio.busy) return;
    studio.draft = draftFrom($state.snapshot(mouse.profile), b.settings, { polling: mouse.canChangePolling });
    profiles.draft = profiles.applied;
    view.open = null;
    close();
  }
  async function onFile(e) {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    const n = await importFile(file);
    note = n === null ? t('backup.badFile') : t('backup.imported', { n });
  }
</script>

<aside class="drawer" class:on={view.drawer} bind:this={el} aria-hidden={!view.drawer} aria-label={view.drawer ? t(`${view.drawer}.title`) : undefined}>
  {#if view.drawer === 'history'}
    <div class="dhead"><h2 class="disp">{t('history.title')}</h2><button class="iconbtn" type="button" data-close aria-label={t('history.close')} onclick={close}><Icon name="close" /></button></div>
    <p class="sub">{t('history.lede')}</p>
    <p class="note">{backups.failed ? t('backup.noStorage') : backups.persisted ? t('backup.safe') : t('backup.unsafe')}</p>
    {#if backups.loaded && !backups.list.length}
      <p class="note">{t('backup.empty')}</p>
    {:else}
      <div class="tl">
        {#each newest as b, i (b.id)}
          <div class="tle">
            <i class="dot" style:--c={dot(b)}></i>
            <span>
              <span class="hch">{#each describe(newest[i + 1]?.settings, b.settings) as c, j (j)}
                <span>{#if c.b === undefined}{c.k}{:else}{c.k} <span class="was">{c.a}</span> <span class="arr">→</span> {c.b}{/if}</span>
              {/each}</span>
              <small>{when(b.at)} · {reason(b)}</small>
            </span>
            {#if b.id === current}<span class="now">{t('history.onMouse')}</span>
            {:else}<button class="btn small" type="button" disabled={!ready || studio.busy || isDirty()} title={isDirty() ? t('backup.editsFirst') : undefined} onclick={() => goBack(b)}>{t('history.goBack')}</button>{/if}
          </div>
        {/each}
      </div>
    {/if}
    <div class="dfoot">
      <button class="btn icon-start" type="button" disabled={!backups.list.length} onclick={exportAll}><Icon name="download" />{t('backup.export')}</button>
      <button class="btn icon-start" type="button" onclick={() => picker.click()}><Icon name="upload" />{t('history.import')}</button>
      <input bind:this={picker} type="file" accept="application/json,.json" hidden onchange={onFile}>
    </div>
    {#if note}<p class="note" role="status">{note}</p>{/if}
  {:else if view.drawer === 'settings'}
    <div class="dhead"><h2 class="disp">{t('settings.title')}</h2><button class="iconbtn" type="button" data-close aria-label={t('settings.close')} onclick={close}><Icon name="close" /></button></div>
    <section class="sgroup">
      <p class="skick"><Icon name="mouse" /><span>{t('settings.mouse')}</span></p>
      <h3>{t('device.shell')}</h3><ShellPicker />
    </section>
    <section class="sgroup">
      <p class="skick"><Icon name="sun" /><span>{t('settings.display')}</span></p>
      {#if ready}<h3>{t('settings.dpiView')}</h3><DpiPicker />{/if}
      <h3>{t('settings.theme')}</h3>
      <div class="choices" role="radiogroup" aria-label={t('settings.theme')}>
        {#each THEMES as th (th)}<button type="button" role="radio" aria-checked={prefs.theme === th} onclick={() => setPref('theme', th)}><Icon name={th === 'dark' ? 'moon' : 'sun'} /><span>{t(`settings.theme.${th}`)}</span></button>{/each}
      </div>
      <h3>{t('device.lang')}</h3>
      <div class="choices" role="radiogroup" aria-label={t('device.lang')}>
        {#each Object.entries(LANGS) as [code, name] (code)}<button type="button" role="radio" aria-checked={i18n.lang === code} lang={code} onclick={() => setLang(code)}><span>{name}</span></button>{/each}
      </div>
    </section>
    <section class="sgroup">
      <p class="skick"><Icon name="info-box" /><span>{t('settings.about')}</span></p>
      <div class="safe"><Icon name="shield" /><p>{@html t('settings.safe')}</p></div>
      <h3>{t('report.title')}</h3><p class="note">{t('report.lede')}</p><ReportActions />
      <h3>{t('settings.madeBy')}</h3><Credits />
    </section>
  {/if}
</aside>
