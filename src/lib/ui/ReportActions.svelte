<script>
  // Two ways to tell about a problem: copy the report, or open an issue with it already written. The user sees and
  // sends it themselves; the app sends nothing.
  import { buildReport, issueUrl } from '../device/report.js';
  import { t } from '../i18n/index.svelte.js';
  import Icon from './Icon.svelte';

  let { error = null } = $props();

  let report = $state('');
  $effect(() => { const err = error; buildReport(err).then(r => { if (err === error) report = r; }); });
  const url = $derived(report ? issueUrl(report, error) : null);

  let copied = $state(false), timer;
  async function copy() {
    const text = await buildReport(error);
    try { await navigator.clipboard.writeText(text); } catch {
      // Without clipboard permission: the old way, through a selected field.
      const f = Object.assign(document.createElement('textarea'), { value: text });
      document.body.append(f); f.select(); document.execCommand('copy'); f.remove();
    }
    copied = true; clearTimeout(timer); timer = setTimeout(() => (copied = false), 1800);
  }
</script>

<div class="reportacts">
  <button class="btn small icon-start" type="button" onclick={copy}><Icon name={copied ? 'check' : 'copy'} /><span aria-live="polite">{t(copied ? 'report.copied' : 'report.copy')}</span></button>
  {#if url}<a class="btn small icon-start" href={url} target="_blank" rel="noopener"><Icon name="github" />{t('report.issue')}</a>{/if}
</div>
