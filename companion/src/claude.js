import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Use the official CLI's own subscription session. Never read its credential
// files or forward its OAuth token to an API. No shell or model tools are used.
export function subscriptionEnvironment(source = process.env) {
  const env = { ...source };
  for (const name of Object.keys(env)) {
    if (/^(ANTHROPIC_|CLAUDE_CODE_USE_|CLAUDE_CODE_OAUTH_TOKEN|CLAUDECODE$)/.test(name)) delete env[name];
  }
  return env;
}
export class Claude {
  constructor({ directory, command = 'claude', spawnImpl = spawn }) { Object.assign(this, { directory, command, spawn: spawnImpl }); }
  async init() { this.cwd = join(this.directory, 'claude-workspace'); await mkdir(this.cwd, { recursive: true, mode: 0o700 }); }
  run(args, input = '', signal, onProgress, timeoutMs = 30 * 60 * 1000) {
    return new Promise((resolve, reject) => {
      const child = this.spawn(this.command, args, { cwd: this.cwd, env: subscriptionEnvironment(), shell: false, stdio: ['pipe', 'pipe', 'pipe'], signal });
      let stdout = '', stderr = '', settled = false;
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
      const timer = setTimeout(() => { child.kill('SIGTERM'); finish(new Error('Claude took too long. Resume to retry this lesson.')); }, timeoutMs);
      child.stdout.on('data', chunk => {
        stdout += chunk;
        onProgress?.(stdout.length);
        if (stdout.length > 3_000_000) { child.kill('SIGTERM'); finish(new Error('Claude output exceeded the safe size.')); }
      });
      child.stderr.on('data', chunk => { if (stderr.length < 8000) stderr += chunk; });
      child.on('error', error => finish(new Error(error.code === 'ENOENT' ? 'Install Claude Code, then run claude auth login in your terminal.' : signal?.aborted ? 'Generation paused.' : 'Claude Code could not start. Check its installation and sign-in.')));
      child.on('close', code => {
        if (settled) return;
        if (signal?.aborted) return finish(new Error('Generation paused.'));
        try {
          const value = JSON.parse(stdout);
          if (code !== 0 || value.is_error) throw new Error('CLI failed');
          finish(null, value);
        } catch { finish(new Error('Claude Code could not complete the request. Check claude auth status, subscription allowance, and update the CLI.')); }
      });
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    });
  }
  async status() {
    try {
      const info = await this.run(['auth', 'status'], '', undefined, undefined, 15000);
      // Refuse API keys, console billing, and third-party providers. Unknown
      // authentication methods fail closed instead of silently charging API use.
      const connected = info.loggedIn === true && info.authMethod === 'claude.ai';
      return { installed: true, connected, email: info.email || '', message: connected ? '' : 'Run claude auth login and choose your Claude subscription, not Console/API billing.' };
    } catch (error) { return { installed: !error.message.startsWith('Install'), connected: false, email: '', message: error.message }; }
  }
  async models() { return [{ id: 'opus', name: 'Claude Opus' }, { id: 'sonnet', name: 'Claude Sonnet' }]; }
  async generate({ prompt, model, effort, signal, onProgress, account }) {
    const status = await this.status();
    if (!status.connected) throw new Error(status.message);
    if (account && status.email !== account) throw new Error('Reconnect the subscription account used to create this job before resuming it.');
    if (!['opus', 'sonnet'].includes(model)) throw new Error('Choose a supported Claude model.');
    const args = ['-p', '--output-format', 'json', '--model', model,
      '--system-prompt', 'Write a complete lesson following the supplied teaching prompt. Return only its plain-text content. No files, tools, or external actions are needed.',
      '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--setting-sources', '', '--settings', '{"disableAllHooks":true,"forceLoginMethod":"claudeai"}',
      '--no-session-persistence', '--max-turns', '1'];
    if (effort && effort !== 'default') args.push('--effort', effort);
    const result = await this.run(args, prompt, signal, onProgress);
    if (result.type !== 'result' || result.subtype !== 'success' || typeof result.result !== 'string') throw new Error('Claude did not return a finished lesson. Resume to retry.');
    return result.result;
  }
}
