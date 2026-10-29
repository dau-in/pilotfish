// Where backups live: this browser's IndexedDB, asked to be persistent so that clearing space does not take them.
// The browser can still lose them (clearing site data, another device), which is what export is for.
const DB = 'pilotfish';
const STORE = 'backups';

let opening = null;
function db() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error); };
  });
  return opening;
}

async function run(mode, work) {
  const tx = (await db()).transaction(STORE, mode);
  const result = work(tx.objectStore(STORE));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(result.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export const all = () => run('readonly', s => s.getAll());
export const add = backup => run('readwrite', s => s.add(backup));
export const put = backup => run('readwrite', s => s.put(backup));
export const remove = ids => run('readwrite', s => { ids.forEach(id => s.delete(id)); return {}; });

// Chrome grants this without asking for installed apps and sites used often, and quietly refuses otherwise.
export async function persist() {
  if (!navigator.storage?.persist) return false;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}
