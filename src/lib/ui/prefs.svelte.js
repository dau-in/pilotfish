// How this browser shows the app: the colour of the user's X11 (the mouse doesn't report it: same ids and firmware
// for every colour), the theme, how the DPI levels are drawn, and whether the first run has been seen. Kept in this
// browser only.
const KEY = 'pilotfish.prefs';
const OLD_SHELL = 'pilotfish.shell'; // before the prefs were one entry

export const SHELLS = ['white', 'black', 'red'];
export const THEMES = ['dark', 'light'];
export const DPI_VIEWS = ['faders', 'dial'];

function load() {
  const d = { shell: 'red', theme: 'dark', dpiView: 'faders', firstRun: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {};
    const shell = saved.shell ?? localStorage.getItem(OLD_SHELL);
    return {
      shell: SHELLS.includes(shell) ? shell : d.shell,
      theme: THEMES.includes(saved.theme) ? saved.theme : d.theme,
      dpiView: DPI_VIEWS.includes(saved.dpiView) ? saved.dpiView : d.dpiView,
      firstRun: Boolean(saved.firstRun),
    };
  } catch {
    return d;
  }
}

export const prefs = $state(load());

export function setPref(key, value) {
  prefs[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify($state.snapshot(prefs))); } catch { /* private window: this visit only */ }
}
