<script>
  import { autoConnect, disconnect, mouse } from '../device/mouse.svelte.js';
  import { clock, errorText, t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';
  import ProfileMenu from './ProfileMenu.svelte';
  import { daysLeft } from './battery.svelte.js';
  import { byId, profiles } from './profiles.svelte.js';
  import { apply, discard, isDirty, pending, studio, undo } from './studio.svelte.js';
  import { closeCard, reduced, view } from './view.svelte.js';

  let { markSrc, ready } = $props();

  // The link's own icon, on the icons' pixel grid: its body, and the signal that pulses (s1 to s3).
  const GLYPH = {
    dongle: '<path class="base" d="M8 13h8v2H8zM8 15h2v7H8zM14 15h2v7h-2zM10 20h4v2h-4zM11 17h2v2h-2z"/><path class="sig s1" d="M11 9h2v2h-2z"/><path class="sig s2" d="M8 7h2v2H8zM14 7h2v2h-2zM10 5h4v2h-4z"/><path class="sig s3" d="M5 5h2v2H5zM17 5h2v2h-2zM7 3h2v2H7zM15 3h2v2h-2zM9 1h6v2H9z"/>',
    cable: '<path class="base" d="M8 1h8v2H8zM6 3h2v8H6zM16 3h2v8h-2zM10 5h4v2h-4zM6 11h12v2H6zM10 13h4v3h-4z"/><path class="sig s1" d="M11 16h2v2h-2z"/><path class="sig s2" d="M11 18h2v2h-2z"/><path class="sig s3" d="M11 20h2v3h-2z"/>',
    bluetooth: '<path class="base" d="M11 2h2v20h-2zm2 2h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zM9 10h2v2H9zM7 8h2v2H7zm6 6h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zM9 12h2v2H9zm-2 2h2v2H7z"/><path class="sig s1" d="M3 11h2v2H3z"/><path class="sig s2" d="M19 11h2v2h-2z"/><path class="sig s3" d="M1 9h1v6H1zM22 9h1v6h-1z"/>',
  };

  const kind = $derived(mouse.kind ?? 'dongle');
  const bat = $derived(mouse.battery);
  const days = $derived(bat?.state === 'battery' ? daysLeft(bat.level) : null);

  // The signal pulses with every heartbeat over the receiver.
  let sig = $state();
  $effect(() => {
    if (!mouse.beatAt || !sig || kind !== 'dongle' || reduced()) return;
    sig.classList.remove('pulse'); void sig.getBoundingClientRect(); sig.classList.add('pulse');
  });
  // A new link: the capsule takes it with a beat of the accent.
  let capsule = $state(), lastKind = null;
  $effect(() => {
    const k = mouse.kind;
    if (k && lastKind && k !== lastKind && capsule) { capsule.classList.remove('relink'); void capsule.offsetWidth; capsule.classList.add('relink'); }
    if (k) lastKind = k;
  });

  // "Last check-in 4 s ago", while the details are open.
  let now = $state(Date.now());
  $effect(() => {
    if (view.pop !== 'status') return;
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });
  const ago = $derived(Math.max(0, Math.round((now - mouse.beatAt) / 1000)));

  /* ---------- The slot: changes waiting, writing, saved ---------- */
  const dirty = $derived(ready && isDirty());
  const list = $derived(dirty ? pending() : []);
  const otherProfile = $derived(profiles.draft !== profiles.applied ? byId(profiles.draft) : null);
  // What happened last stays for a few seconds; a failure stays while its changes do.
  let note = $state(null), noteTimer = 0;
  $effect(() => {
    const d = studio.done;
    clearTimeout(noteTimer);
    note = d;
    if (d && d.key !== 'failed') noteTimer = setTimeout(() => (note = null), 8000);
  });
  $effect(() => { if (dirty && note?.key !== 'failed') note = null; });
  const prog = $derived(studio.progress ? (studio.progress.i + 1) / studio.progress.n : studio.done ? 1 : 0);

  const togglePop = which => { view.pop = view.pop === which ? null : which; };
  const openDrawer = kind => { view.pop = null; view.drawer = kind; };
  async function reread() {
    view.pop = null;
    await disconnect();
    await autoConnect();
  }
  // Clicking outside a popover closes it.
  $effect(() => {
    if (!view.pop) return;
    const out = e => { if (!e.target.closest(view.pop === 'status' ? '.capsule-wrap' : '.pw')) view.pop = null; };
    addEventListener('pointerdown', out);
    return () => removeEventListener('pointerdown', out);
  });
  const enterLab = () => { closeCard(); view.pop = null; view.testing = true; };
</script>

<header class="top">
  <div class="lead">
    <div class="brand"><img src={markSrc} alt=""><span class="disp">{t('app.name')}</span></div>
    {#if ready}<ProfileMenu />{/if}
  </div>
  <div class="right">
    {#if ready}
      <div class="slot" class:err={note?.key === 'failed'} role="status">
        {#if studio.busy}
          <span><b>{t('slot.writing')}</b><span class="long"> {t('slot.what', studio.progress ?? {})}</span></span>
        {:else if dirty}
          {#if note?.key === 'failed'}
            <Icon name="alert" /><span title={errorText(note.err)}><b>{t('slot.failed')}</b><span class="long"> {errorText(note.err)}</span></span>
          {:else}
            <span class="count" title={t('slot.title', { profile: otherProfile?.name, list: list.join(', ') })}><b>{t('slot.count', { n: list.length })}</b></span>
          {/if}
          <button class="no" type="button" onclick={() => { closeCard(); discard(); }}>{t('action.discard')}</button>
          <button class="btn go small" type="button" onclick={() => apply()}><span>{t('slot.apply')}<span class="long">{t('slot.applyLong')}</span></span></button>
        {:else if note && note.key !== 'failed'}
          <Icon name="check" /><span><b>{t(`slot.${note.key}`)}</b><span class="long">{t(`slot.${note.key}Long`)}</span></span>
          {#if studio.undo}<button class="btn small icon-start" type="button" title={t('action.undoTitle')} onclick={() => undo()}><Icon name="undo" />{t('action.undo')}</button>{/if}
        {/if}
      </div>
      <div class="wrap capsule-wrap">
        <button class="capsule" type="button" bind:this={capsule} aria-haspopup="dialog" aria-expanded={view.pop === 'status'} onclick={() => togglePop('status')}
          aria-label={t('capsule.aria', { link: t(`link.short.${kind}`), asleep: mouse.asleep, level: bat?.level })}>
          <span class="lk"><svg class="ig" class:asleep={mouse.asleep} class:steady={!mouse.asleep && kind !== 'dongle'} bind:this={sig} viewBox="0 0 24 24" aria-hidden="true">{@html GLYPH[kind]}</svg><span>{t(`link.short.${kind}`)}</span></span>
          {#if bat}
            <span class="sep"></span>
            <span class="bt"><svg class="bat" class:low={bat.state === 'battery' && bat.level <= 15} class:charging={bat.state !== 'battery'} viewBox="0 0 26 13" aria-hidden="true">
              <rect class="shell" x=".75" y=".75" width="21.5" height="11.5" rx="3"/><rect class="nub" x="23.5" y="4" width="2" height="5" rx="1"/>
              <rect class="fill" x="3" y="3" height="7" rx="1.5" width={(17 * (bat.state === 'full' ? 100 : bat.level) / 100).toFixed(1)}/></svg><span class="fig">{bat.state === 'full' ? 100 : bat.level} %</span></span>
          {/if}
        </button>
        <div class="pop status-pop" class:on={view.pop === 'status'} role="dialog" aria-label={t('status.aria')}>
          <h3 class="disp">{t('device.model')}</h3>
          <div class="rowline"><span>{t('status.through', { link: t(`link.${kind}`) })}<small>{kind === 'dongle' ? t('status.dongle', { ago, asleep: mouse.asleep }) : t(`status.${kind}`)}</small></span></div>
          {#if bat}
            <div class="rowline"><span>{t('status.battery')} <span class="fig">{bat.state === 'full' ? 100 : bat.level} %</span><small>{bat.state === 'battery' ? t('battery.days', { n: days }) : t(`battery.${bat.state}Now`)}</small></span></div>
          {/if}
          <div class="rowline"><span>{t('device.firmware')} <span class="fig">{mouse.version}</span><small>{t('status.readAt', { time: mouse.readAt ? clock(mouse.readAt) : '' })}</small></span></div>
          <div class="acts"><button class="btn small icon-start" type="button" onclick={reread}><Icon name="reload" />{t('status.reread')}</button></div>
        </div>
      </div>
      <button class="labbtn" type="button" title={t('lab.title')} onclick={enterLab}><Icon name="bullseye-arrow" /><span>{t('lab.button')}</span></button>
    {/if}
    <a class="iconbtn gh" href="https://github.com/dau-in/pilotfish" target="_blank" rel="noopener" title={t('header.github')} aria-label={t('header.github')}><Icon name="github" /></a>
    <button class="iconbtn" type="button" title={t('history.title')} aria-label={t('history.title')} onclick={() => openDrawer('history')}><Icon name="timeline" /></button>
    <button class="iconbtn" type="button" title={t('settings.title')} aria-label={t('settings.title')} onclick={() => openDrawer('settings')}><Icon name="sliders" /></button>
  </div>
  <i class="hprog" style:width="{prog * 100}%" style:opacity={studio.busy ? 1 : 0}></i>
  <!-- The lab's own bar: while testing it replaces the header. -->
  <div class="labbar">
    <span class="lt"><Icon name="bullseye-arrow" /><b class="disp">{t('lab.heading')}</b><span>{t('lab.lede')}</span></span>
    <button class="btn go small" type="button" onclick={() => (view.testing = false)}>{t('lab.done')}</button>
  </div>
</header>
