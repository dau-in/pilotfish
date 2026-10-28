// The app's words. English first, Spanish as well; the browser's language picks one until the user chooses.
// t(key, vars) returns the current language's text: a string with {placeholders}, or a function of vars for
// sentences that change shape (plurals, optional parts). A key missing in Spanish falls back to English.
import en from './en.js';
import es from './es.js';

const DICTS = { en, es };
export const LANGS = { en: 'English', es: 'Español' };
const KEY = 'pilotfish.lang';

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved in DICTS) return saved;
  } catch { /* storage blocked: fall back to the browser's language */ }
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  return prefs.some(l => l?.toLowerCase().startsWith('es')) ? 'es' : 'en';
}

export const i18n = $state({ lang: initial() });
if (typeof document !== 'undefined') document.documentElement.lang = i18n.lang;

export function setLang(lang) {
  if (!(lang in DICTS)) return;
  i18n.lang = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* only for this visit */ }
}

export function t(key, vars = {}) {
  const entry = DICTS[i18n.lang][key] ?? en[key];
  if (entry === undefined) return key;
  if (typeof entry === 'function') return entry(vars);
  return entry.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// An error from the mouse layers carries a code (see protocol MouseError); anything else (the browser's own
// errors) is shown as it came.
export function errorText(err) {
  if (err?.code) return t(`error.${err.code}`, err.vars);
  return err?.message ?? String(err);
}

export const locale = () => (i18n.lang === 'es' ? 'es-ES' : 'en-US');
export const fmt = n => n.toLocaleString(locale(), { useGrouping: 'always' });
export const clock = d => d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
