const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

function cloudSession(app, getUsername) {
  const reads = [];
  app.window.cloud = {
    getUsername,
    getLibrary: async uid => { reads.push('library:' + uid); return {}; },
    getProgress: async uid => { reads.push('progress:' + uid); return {}; },
  };
  return reads;
}

test('restored session shows signed in and starts sync before the username arrives', async () => {
  const app = loadApp();
  try {
    let resolveUsername;
    const reads = cloudSession(app, () => new Promise(resolve => { resolveUsername = resolve; }));
    const restored = app.window.handleCloudAuthChange({ uid: 'u1', email: 'a@b.co' });
    assert.equal(app.ev('state.accountUser.uid'), 'u1');
    assert.equal(app.document.getElementById('account-name-display').textContent, 'a@b.co');
    assert.equal(app.document.getElementById('account-form-panel').classList.contains('hidden'), true);
    assert.deepEqual(reads, ['library:u1', 'progress:u1']);

    resolveUsername('bob');
    await restored;
    assert.equal(app.document.getElementById('account-name-display').textContent, 'bob');
    assert.match(app.document.querySelector('#btn-account-menu .toolbar-label').textContent, /bob/);
    assert.deepEqual(reads, ['library:u1', 'progress:u1']);
  } finally {
    await new Promise(resolve => setImmediate(resolve));
    app.dom.window.close();
  }
});

test('username lookup failure keeps the restored session signed in', async () => {
  const app = loadApp();
  try {
    cloudSession(app, async () => { throw new Error('offline'); });
    await app.window.handleCloudAuthChange({ uid: 'u1', email: 'a@b.co' });
    assert.equal(app.ev('state.accountUser.uid'), 'u1');
    assert.equal(app.document.getElementById('account-name-display').textContent, 'a@b.co');
  } finally {
    await new Promise(resolve => setImmediate(resolve));
    app.dom.window.close();
  }
});

test('late usernames cannot replace a newer account or restore a signed-out session', async () => {
  const app = loadApp();
  try {
    const pending = {};
    cloudSession(app, uid => new Promise(resolve => { pending[uid] = resolve; }));
    const first = app.window.handleCloudAuthChange({ uid: 'u1', email: 'a@b.co' });
    const second = app.window.handleCloudAuthChange({ uid: 'u2', email: 'b@b.co' });
    pending.u1('old-name');
    await first;
    assert.equal(app.ev('state.accountUser.uid'), 'u2');
    assert.equal(app.document.getElementById('account-name-display').textContent, 'b@b.co');

    await app.window.handleCloudAuthChange(null);
    pending.u2('late-name');
    await second;
    assert.equal(app.ev('state.accountUser'), null);
    assert.equal(app.document.getElementById('account-form-panel').classList.contains('hidden'), false);
  } finally {
    await new Promise(resolve => setImmediate(resolve));
    app.dom.window.close();
  }
});

test('restored session and username stay deferred during the tutorial', async () => {
  const app = loadApp();
  try {
    const reads = cloudSession(app, async () => 'bob');
    app.document.getElementById('menu-tutorial').click();
    await app.window.handleCloudAuthChange({ uid: 'u1', email: 'a@b.co' });
    assert.equal(app.ev('state.accountUser'), null);
    assert.equal(app.ev('state.tutorialPendingAuth.user.username'), 'bob');
    assert.deepEqual(reads, []);

    app.document.getElementById('tutorial-skip').click();
    assert.equal(app.ev('state.accountUser.username'), 'bob');
    assert.deepEqual(reads, ['library:u1', 'progress:u1']);
  } finally {
    await new Promise(resolve => setImmediate(resolve));
    app.dom.window.close();
  }
});
