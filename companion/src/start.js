import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquireLock } from './lock.js';
import { createCompanion } from './server.js';

const port = Number(process.env.LEARNING_TREE_COMPANION_PORT || 8765);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('LEARNING_TREE_COMPANION_PORT must be between 1024 and 65535.');
const directory = resolve(process.env.LEARNING_TREE_COMPANION_DATA || join(homedir(), '.local', 'share', 'learning-tree-companion'));
let release;
try {
  release = await acquireLock(directory);
  const companion = await createCompanion({ directory, port });
  const { server, origin } = await companion.listen();
  console.log(`Learning Tree companion: ${origin}\nKeep this process running while lessons generate. Press Ctrl+C to stop safely.`);
  let closing = false;
  const stop = async () => {
    if (closing) return; closing = true;
    await companion.jobs.shutdown();
    server.close(async () => { await release(); process.exit(0); });
    server.closeIdleConnections();
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch (error) {
  if (release) await release();
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Open http://127.0.0.1:${port} if the companion is already running, or choose another LEARNING_TREE_COMPANION_PORT.` : 'The companion could not start: ' + error.message);
  process.exitCode = 1;
}
