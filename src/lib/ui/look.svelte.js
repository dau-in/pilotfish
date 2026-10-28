// The colour of the user's X11, for the render. The mouse does not report it (same ids and firmware for every
// colour), so the user picks it once and this browser keeps it.
const KEY = 'pilotfish.shell';
const OLD_KEY = 'x11-studio.shell'; // the app's first name
export const SHELLS = ['white', 'black', 'red'];

function saved() {
  try {
    const v = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    return SHELLS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export const look = $state({ shell: saved() ?? 'white' });

export function setShell(shell) {
  look.shell = shell;
  try { localStorage.setItem(KEY, shell); } catch { /* private window: it only lasts this visit */ }
}
