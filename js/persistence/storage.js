/* IndexedDB stores large tree snapshots; localStorage is only the legacy source.
   Keep legacy data until an IndexedDB transaction has committed. */
const browserStore = (() => {
  let database;
  function open() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('learning-tree', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }
  async function read(key) {
    const db = await open();
    if (!db) return JSON.parse(localStorage.getItem(key) || '{}');
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction('records').objectStore('records').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (value !== undefined) return value;
    const legacy = JSON.parse(localStorage.getItem(key) || '{}');
    await write(key, legacy);
    return legacy;
  }
  async function write(key, value) {
    const db = await open();
    if (!db) { localStorage.setItem(key, JSON.stringify(value)); return; }
    await new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      tx.objectStore('records').put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    localStorage.removeItem(key);
  }
  return { read, write };
})();
function stableTreeId(seed) {
  // Two independent hashes give legacy imports a repeatable identity.
  let a = 2166136261, b = 5381;
  for (const c of seed) { a = Math.imul(a ^ c.charCodeAt(0), 16777619); b = Math.imul(b, 33) ^ c.charCodeAt(0); }
  return 'tree_' + (a >>> 0).toString(36) + '_' + (b >>> 0).toString(36);
}
function currentTreeId() {
  return state.treeId || (state.treeId = 'tree_' + crypto.randomUUID());
}
