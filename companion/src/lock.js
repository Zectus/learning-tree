import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// Prevent two local processes from racing rotating refresh tokens/checkpoints.
export async function acquireLock(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, 'companion.lock');
  async function claim() {
    const file = await open(path, 'wx', 0o600);
    await file.writeFile(String(process.pid)); await file.close();
    return () => unlink(path).catch(() => {});
  }
  try { return await claim(); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await readFile(path, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('A companion lock already exists. Check the setup guide before removing it.');
    try { process.kill(pid, 0); }
    catch (probe) {
      if (probe.code !== 'ESRCH') throw new Error('Another companion process may already be running.');
      await unlink(path); return claim();
    }
    throw new Error('The companion is already running for this data directory. Open its existing local app.');
  }
}
