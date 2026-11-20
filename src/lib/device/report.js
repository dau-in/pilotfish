// A report of what went wrong, for the user to copy or put in a GitHub issue themselves; nothing is sent from here.
// It says which app, browser and system, how the mouse was connected, how the browser sees it, the error and the
// last steps. No settings, no profiles, nothing of the user's: written in English, for whoever reads the issue.
import { version } from '../../../package.json';
import { diagnostics } from './mouse.svelte.js';
import { recent } from './trace.js';

const REPO = 'https://github.com/dau-in/pilotfish';
const hex = n => n.toString(16).padStart(4, '0');

async function browser() {
  const ua = navigator.userAgentData;
  if (!ua?.getHighEntropyValues) return navigator.userAgent;
  try {
    const v = await ua.getHighEntropyValues(['fullVersionList', 'platformVersion']);
    // The named browser (Chrome, Edge, Opera…), else Chromium; the made-up "Not A Brand" entry never.
    const list = (v.fullVersionList ?? []).filter(b => !/not.?a.?brand/i.test(b.brand));
    const brand = list.find(b => !/chromium/i.test(b.brand)) ?? list[0];
    // Windows 11 reports platform version 13 and up; 10 reports below.
    const win = ua.platform === 'Windows' && v.platformVersion ? (parseInt(v.platformVersion, 10) >= 13 ? ' 11' : ' 10') : '';
    return `${brand ? `${brand.brand} ${brand.version}` : 'unknown'} on ${ua.platform}${win} (${v.platformVersion ?? '?'})`;
  } catch { return navigator.userAgent; }
}

// The device as WebHID describes it: its collections and the reports each declares, with their sizes in bytes.
function hidDevice(d) {
  return {
    name: d.productName, id: `${hex(d.vendorId)}:${hex(d.productId)}`,
    collections: d.collections.map(c => ({
      page: hex(c.usagePage), usage: hex(c.usage),
      feature: c.featureReports.map(r => [r.reportId, r.items.reduce((a, i) => a + i.reportSize * i.reportCount, 0) / 8]),
      input: c.inputReports.map(r => r.reportId), output: c.outputReports.map(r => r.reportId),
    })),
  };
}

function errorLine(err) {
  if (!err) return 'none';
  const code = err.code ? `${err.code}${Object.keys(err.vars ?? {}).length ? ` ${JSON.stringify(err.vars)}` : ''}` : err.name;
  const cause = err.cause ? ` (browser: ${err.cause.name}: ${err.cause.message})` : err.code ? '' : `: ${err.message}`;
  return code + cause;
}

export async function buildReport(err) {
  const d = diagnostics();
  const error = err ?? d.error;
  const lines = [
    '### What happened',
    '',
    '<!-- A line or two: what you did and what you saw. -->',
    '',
    '### Report',
    '',
    `- App: Pilotfish ${version}, ${location.host}`,
    `- Browser: ${await browser()}`,
    `- WebHID: ${'hid' in navigator ? 'yes' : 'no'}, Web Bluetooth: ${'bluetooth' in navigator ? 'yes' : 'no'}`,
    `- Link: ${d.kind ?? 'none'}, status ${d.status}${d.version ? `, firmware ${d.version}` : ''}`,
    `- Error: ${errorLine(error)}`,
  ];
  if (d.device?.collections) lines.push('', '<details><summary>The mouse as the browser sees it</summary>', '', '```json', JSON.stringify(hidDevice(d.device), null, 1), '```', '</details>');
  else if (d.device) lines.push(`- Bluetooth device: ${d.device.name ?? 'unnamed'}`);
  const steps = recent();
  if (steps.length) lines.push('', '<details><summary>Last steps</summary>', '', '```', ...steps, '```', '</details>');
  return lines.join('\n');
}

// GitHub takes the issue's text in the address; long ones are cut at the steps, which matter least.
export function issueUrl(report, err) {
  const title = `Problem: ${err?.code ?? err?.name ?? 'report'}`;
  let body = report;
  while (body.length > 6000) {
    const shorter = body.replace(/\n {0,8}\d+\.\ds {2}[^\n]*/, '');
    if (shorter === body) { body = body.slice(0, 6000); break; }
    body = shorter;
  }
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
