import { mkdir, readFile, open, rename, unlink, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Serialized, atomic, private snapshots. The previous snapshot survives a crash
// before rename. The app never serves this directory over HTTP.
export class Storage {
  constructor(directory) { this.directory = directory; this.tail = Promise.resolve(); }
  async init() { await mkdir(this.directory, { recursive: true, mode: 0o700 }); await chmod(this.directory, 0o700); }
  path(name) {
    if (!/^[a-z0-9_-]+\.json$/.test(name)) throw new Error('Invalid storage name.');
    return join(this.directory, name);
  }
  async read(name, fallback = null) {
    try { return JSON.parse(await readFile(this.path(name), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  }
  async write(name, value) {
    const path = this.path(name), temporary = path + '.' + randomUUID() + '.tmp';
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
    await rename(temporary, path);
  }
  async remove(name) { await unlink(this.path(name)).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  exclusive(fn) {
    const next = this.tail.then(fn);
    this.tail = next.catch(() => {});
    return next;
  }
}
