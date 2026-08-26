/* ═══════════════════════════════════════════════════════════
   account.js — the sign up / sign in / signed-in account modal.
   Owns nothing Firebase-specific itself — it only ever calls
   window.cloud.* (set up by cloud.js, a module that runs after
   this file — see index.html) and reacts to auth-state changes
   through window.handleCloudAuthChange, which this file defines
   and cloud.js calls on every change, including once at load
   with whatever session was already persisted.

   TOOLBAR SPLIT: "👤 ..." is now the trigger for a dropdown (see
   toolbar.js's generic mechanism) rather than a button that
   directly opened this modal. #btn-account-menu is that trigger —
   its own label shows the signed-in identity (or "sign in") the
   same way the Mode trigger always shows the current mode — and
   #menu-account is the actual item inside that dropdown whose
   click opens this modal. Reset progress and dark mode live in
   the same dropdown but are wired up in progress.js/toolbar.js,
   not here.

   USERNAME DISPLAY: two things make this trickier than it looks.

   1. On sign-up, Firebase's onAuthStateChanged fires the instant
      the account is created — before claimUsername() has actually
      written anything to the database. handleCloudAuthChange
      below runs right then, finds no username yet, and falls back
      to email. Since the uid never changes again afterward, that
      listener never fires a second time to fix it — so submitAccountForm
      updates state.accountUser directly the moment claimUsername
      actually succeeds, instead of hoping another auth event will
      come along and pick it up.
   2. Firebase can also fire onAuthStateChanged more than once in
      quick succession (e.g. a fast sign-out immediately followed by
      a sign-in). Each call kicks off its own async getUsername()
      lookup, and network timing offers no guarantee they resolve in
      the order they were fired — authGeneration below is a simple
      "ignore me if a newer call has already started" guard so an
      older, slower lookup can never overwrite a newer one.

   Depends on state.js (state.accountUser), library.js
   (refreshLibraryFromSource — signing in/out is what decides
   whether "My Trees" reads from this browser or from the
   account's cloud copy, so every auth change re-triggers it).
═══════════════════════════════════════════════════════════ */

let accountMode = 'signin'; // 'signin' | 'signup' — which form the modal is currently showing
let authGeneration = 0;     // bumped on every auth event; a stale in-flight lookup checks this before writing state

function setAccountMode(mode) {
  accountMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('account-username-row').classList.toggle('hidden', !isSignup);
  document.getElementById('account-modal-title').textContent   = isSignup ? 'Create an account' : 'Sign in';
  document.getElementById('account-submit-btn').textContent    = isSignup ? 'Sign up' : 'Sign in';
  document.getElementById('account-toggle-text').textContent   = isSignup ? 'Already have an account? ' : "Don't have an account? ";
  document.getElementById('account-toggle-btn').textContent    = isSignup ? 'Sign in' : 'Sign up';
  clearAccountError();
}

function clearAccountError() {
  const el = document.getElementById('account-error');
  el.textContent = '';
  el.classList.add('hidden');
}
function showAccountError(msg) {
  const el = document.getElementById('account-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* Applies a signed-in/signed-out user everywhere it's displayed: the
   toolbar trigger label, the modal panel, and (via refreshLibraryFromSource)
   which storage source "My Trees" reads from. */
function applyAccountUser(user) {
  state.accountUser = user;
  updateAccountButton();
  if (user) showSignedInPanel(user); else showSignedOutPanel();
  if (typeof refreshLibraryFromSource === 'function') refreshLibraryFromSource();
}

/* Re-checks the username for the currently signed-in user and updates
   every place it's displayed, if it turns out we have one but weren't
   showing it. Called right after a successful signup claim (see
   submitAccountForm) and defensively whenever the account modal is
   opened, as a general safety net against any other way this could have
   gone stale (a slow network request that failed silently, etc). */
function openAccountModal() {
  document.getElementById('account-modal-backdrop').classList.add('open');
  if (state.accountUser && !state.accountUser.username && window.cloud) {
    window.cloud.getUsername(state.accountUser.uid).then(username => {
      if (username && state.accountUser) {
        state.accountUser.username = username;
        updateAccountButton();
        showSignedInPanel(state.accountUser);
      }
    }).catch(() => {});
  }
}
function closeAccountModal() {
  document.getElementById('account-modal-backdrop').classList.remove('open');
}

function showSignedOutPanel() {
  document.getElementById('account-form-panel').classList.remove('hidden');
  document.getElementById('account-signed-in-panel').classList.add('hidden');
  document.getElementById('account-modal-meta').textContent = 'sign in to sync your trees across devices';
}
function showSignedInPanel(user) {
  document.getElementById('account-form-panel').classList.add('hidden');
  document.getElementById('account-signed-in-panel').classList.remove('hidden');
  document.getElementById('account-name-display').textContent = user.username || user.email;
  document.getElementById('account-email-line').textContent = user.username ? user.email : '';
  document.getElementById('account-email-line').classList.toggle('hidden', !user.username);
  document.getElementById('account-modal-meta').textContent = 'your trees are synced to this account';
}

/* Updates the toolbar dropdown TRIGGER (#btn-account-menu) — the label
   that's visible without opening the menu at all, same convention as the
   Mode trigger always showing the current mode. The item inside the menu
   that actually opens this modal (#menu-account) stays static; see the
   click wiring at the bottom of this file. */
function updateAccountButton() {
  const btn = document.getElementById('btn-account-menu');
  if (state.accountUser) {
    btn.textContent = '👤 ' + (state.accountUser.username || state.accountUser.email) + ' ▾';
    btn.classList.add('active');
  } else {
    btn.textContent = '👤 sign in ▾';
    btn.classList.remove('active');
  }
}

/* The hook cloud.js calls into (via Firebase's onAuthStateChanged), every
   time the signed-in user changes — including once, right after page
   load, with whatever session Firebase already had persisted. See the
   file header above for the two race conditions this guards against. */
window.handleCloudAuthChange = async function (user) {
  const gen = ++authGeneration;
  if (!user) {
    applyAccountUser(null);
    return;
  }
  let username = null;
  try { username = await window.cloud.getUsername(user.uid); } catch {}
  if (gen !== authGeneration) return; // a newer auth event has already superseded this one — don't clobber it
  applyAccountUser({ uid: user.uid, email: user.email, username });
};

function isValidUsername(name) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(name);
}

function friendlyAuthError(err) {
  switch (err?.code) {
    case 'auth/email-already-in-use': return 'That email is already registered — try signing in instead.';
    case 'auth/invalid-email':        return "That doesn't look like a valid email address.";
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':       return 'Email or password is incorrect.';
    case 'auth/weak-password':        return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':    return 'Too many attempts — wait a moment and try again.';
    default: return err?.message || 'Something went wrong — try again.';
  }
}

async function submitAccountForm() {
  const email    = document.getElementById('account-email-input').value.trim();
  const password = document.getElementById('account-password-input').value;
  const username = document.getElementById('account-username-input').value.trim();
  clearAccountError();

  if (!email || !password) { showAccountError('Enter an email and password.'); return; }
  if (password.length < 6)  { showAccountError('Password must be at least 6 characters.'); return; }
  if (accountMode === 'signup' && !isValidUsername(username)) {
    showAccountError('Usernames are 3–20 characters: letters, numbers, underscores, or hyphens.');
    return;
  }
  if (!window.cloud) { showAccountError('Still connecting — try again in a moment.'); return; }

  const btn = document.getElementById('account-submit-btn');
  btn.disabled = true;
  try {
    if (accountMode === 'signup') {
      const cred = await window.cloud.signUp(email, password);
      const claimed = await window.cloud.claimUsername(cred.user.uid, username);
      if (!claimed) {
        await window.cloud.deleteCurrentUser(); // roll back — don't leave a username-less account behind
        showAccountError('That username is already taken — try another.');
        return;
      }
      // onAuthStateChanged already fired once, right when the account was
      // created — before this claim existed — and cached a null username
      // (see the file header). It won't fire again for the same uid, so
      // apply the now-known-good state directly rather than waiting for
      // an event that isn't coming.
      authGeneration++; // invalidate that earlier, now-stale lookup if it's still in flight
      applyAccountUser({ uid: cred.user.uid, email: cred.user.email, username });
    } else {
      await window.cloud.signIn(email, password);
    }
    document.getElementById('account-username-input').value = '';
    document.getElementById('account-email-input').value = '';
    document.getElementById('account-password-input').value = '';
    closeAccountModal();
  } catch (err) {
    showAccountError(friendlyAuthError(err));
  } finally {
    btn.disabled = false;
  }
}

async function submitSignOut() {
  if (!window.cloud) return;
  try { await window.cloud.signOutUser(); } catch {}
  closeAccountModal();
}

document.getElementById('menu-account').addEventListener('click', openAccountModal);
document.getElementById('account-modal-close').addEventListener('click', closeAccountModal);
document.getElementById('account-modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('account-modal-backdrop')) closeAccountModal();
});
document.getElementById('account-toggle-btn').addEventListener('click', () => setAccountMode(accountMode === 'signin' ? 'signup' : 'signin'));
document.getElementById('account-submit-btn').addEventListener('click', submitAccountForm);
document.getElementById('account-signout-btn').addEventListener('click', submitSignOut);
document.getElementById('account-password-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitAccountForm(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('account-modal-backdrop').classList.contains('open')) closeAccountModal();
});

setAccountMode('signin');
