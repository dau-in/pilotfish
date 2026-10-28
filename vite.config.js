import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const listFiles = dir => readdirSync(dir, { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]));

// Writes dist/sw.js with every file of this build in it, so the app opens without a connection. The cache is
// named after the file list, so each deploy gets its own and the old one is dropped.
function offline() {
  return {
    name: 'x11-offline',
    apply: 'build',
    generateBundle(_, bundle) {
      const pub = listFiles('public').map(f => relative('public', f).replaceAll('\\', '/'));
      const files = ['/', ...Object.keys(bundle), ...pub].map(f => (f.startsWith('/') ? f : `/${f}`))
        .filter(f => !f.endsWith('.woff')); // the woff2 copies are the ones browsers that run this app load
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE = 'pilotfish-${version}';\nconst FILES = ${JSON.stringify(files)};\n${SW_BODY}`,
      });
    },
  };
}

// No skipWaiting: a new version takes over the next time the app is opened, never while it may be talking to
// the mouse.
const SW_BODY = `
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    // The page from the network when there is one (so a deploy shows up), the saved one otherwise.
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }
  // ignoreVary: the scripts are requested with an Origin header (crossorigin) that the saved copies lack.
  e.respondWith(caches.match(e.request, { ignoreVary: true }).then(hit => hit ?? fetch(e.request)));
});
`;

export default defineConfig({
  plugins: [svelte(), offline()],
});
