<script>
  // Profiles, each with an icon of the user's choosing. Loading one is an edit like any other: nothing reaches the
  // mouse until Apply.
  import { mouse } from '../device/mouse.svelte.js';
  import { t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';
  import { PROFILE_ICONS, byId, create, edit, profiles, remove } from './profiles.svelte.js';
  import { closeCard, view } from './view.svelte.js';
  import { isDirty, loadProfile, studio } from './studio.svelte.js';
  import { tick } from 'svelte';

  let form = $state(null); // { id, name, icon } while making or editing one
  let nameEl = $state();
  const shown = $derived(byId(profiles.draft) ?? byId(profiles.applied));

  $effect(() => { if (view.pop !== 'profiles') form = null; });

  async function startForm(f) {
    form = f;
    await tick();
    nameEl?.focus();
    nameEl?.select();
  }
  function save() {
    const name = form.name.trim() || t('profile.untitled');
    if (form.id) edit(form.id, name, form.icon);
    else {
      // A new profile is the setup on screen, edits included; it is the one on the mouse only once they are applied.
      const id = create(name, form.icon, studio.draft);
      profiles.draft = id;
      if (!isDirty()) profiles.applied = id;
    }
    form = null;
  }
  function pick(id) {
    loadProfile(id);
    view.pop = null;
    closeCard();
  }
  const note = p => (p.id === profiles.applied && !isDirty() ? t('profile.onMouse') : t('profile.saved', { at: new Date(p.at) }));
</script>

<div class="wrap pw">
  <button class="profile" type="button" aria-haspopup="dialog" aria-expanded={view.pop === 'profiles'} onclick={() => (view.pop = view.pop === 'profiles' ? null : 'profiles')}>
    <span class="pic"><Icon name={shown?.icon ?? 'home'} /></span><span>{shown?.name ?? t('profile.none')}</span>
    {#if profiles.draft !== profiles.applied}<i class="mod" title={t('mod.title')}></i>{/if}
    <Icon name="chevron-down" />
  </button>
  <div class="pop menu" class:on={view.pop === 'profiles'} role="dialog" aria-label={t('profile.title')}>
    {#if form}
      <h3>{t(form.id ? 'profile.edit' : 'profile.new')}</h3>
      <div class="pform">
        <label>{t('profile.name')}<input bind:this={nameEl} bind:value={form.name} maxlength="24" autocomplete="off" onkeydown={e => { if (e.key === 'Enter') save(); }}></label>
        <div>
          <p class="lbl" id="iconlbl">{t('profile.icon')}</p>
          <div class="icons" role="group" aria-labelledby="iconlbl">
            {#each PROFILE_ICONS as n (n)}
              <button type="button" aria-pressed={form.icon === n} aria-label={t(`icon.${n}`)} onclick={() => (form.icon = n)}><Icon name={n} /></button>
            {/each}
          </div>
        </div>
        <div class="acts">
          {#if form.id && profiles.list.length > 1}<button class="btn small del" type="button" onclick={() => { remove(form.id); form = null; }}>{t('profile.delete')}</button>{/if}
          <button class="btn small" type="button" onclick={() => (form = null)}>{t('action.cancel')}</button>
          <button class="btn go small" type="button" onclick={save}>{t('action.save')}</button>
        </div>
      </div>
    {:else}
      <h3>{t('profile.title')}</h3>
      {#each profiles.list as p (p.id)}
        <div class="prow" aria-current={profiles.draft === p.id ? 'true' : undefined}>
          <button type="button" disabled={studio.busy} onclick={() => pick(p.id)}>
            <span class="ic"><Icon name={p.icon} /></span><span>{p.name}<small>{note(p)}</small></span>
          </button>
          <button class="iconbtn edit" type="button" aria-label={t('profile.editAria', { name: p.name })} onclick={() => startForm({ id: p.id, name: p.name, icon: p.icon })}><Icon name="edit" /></button>
        </div>
      {/each}
      <hr>
      <button class="new" type="button" disabled={!mouse.profile} onclick={() => startForm({ id: null, name: t('profile.nth', { n: profiles.list.length + 1 }), icon: 'gamepad' })}>
        <span class="ic"><Icon name="plus" /></span><span>{t('profile.new')}</span>
      </button>
    {/if}
  </div>
</div>
