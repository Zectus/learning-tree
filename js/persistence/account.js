/* ═══════════════════════════════════════════════════════════
   account.js — the sign up / sign in / signed-in account modal.
   Owns nothing Firebase-specific itself — it only ever calls
   window.cloud.* (set up by cloud.js, a module that runs after
   this file — see index.html) and reacts to auth-state changes
   through window.handleCloudAuthChange, which this file defines
   and cloud.js calls on every change, including once at load
   with whatever session was already persisted.

   USERNAME: collected only at sign-up (sign-in still only needs
   email + password — the username is a display identity, not a
   login credential). Since claiming it can fail (already taken)
   only *after* the Firebase account itself has been created —
   there's no atomic "create account + reserve name" operation
   available client-side — a failed claim rolls the just-created
   account back via cloud.deleteCurrentUser() rather than leaving
   an orphaned, username-less account behind. This does mean
   onAuthStateChanged may briefly report a signed-in user with no
   username in between; handleCloudAuthChange below tolerates that
   the same way it'd tolerate any other momentary null username.

   Depends on state.js (state.accountUser), library.js
   (refreshLibraryFromSource — signing in/out is what decides
   whether "My Trees" reads from this browser or from the
   account's cloud copy, so every auth change re-triggers it).
═══════════════════════════════════════════════════════════ */

let accountMode = 'signin'; // 'signin' | 'signup' — which form the modal is currently showing

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

function openAccountModal() {
  document.getElementById('account-modal-backdrop').classList.add('open');
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

function updateAccountButton() {
  const btn = document.getElementById('btn-account');
  if (state.accountUser) {
    btn.textContent = '👤 ' + (state.accountUser.username || state.accountUser.email);
    btn.classList.add('active');
  } else {
    btn.textContent = '👤 sign in';
    btn.classList.remove('active');
  }
}

/* The one hook cloud.js calls into (via Firebase's onAuthStateChanged),
   every time the signed-in user changes — including once, right after
   page load, with whatever session Firebase already had persisted. This
   is the single place that decides which library source library.js
   should be reading from; see refreshLibraryFromSource() there. */
window.handleCloudAuthChange = async function (user) {
  if (user) {
    let username = null;
    try { username = await window.cloud.getUsername(user.uid); } catch {}
    state.accountUser = { uid: user.uid, email: user.email, username };
  } else {
    state.accountUser = null;
  }
  updateAccountButton();
  if (state.accountUser) showSignedInPanel(state.accountUser); else showSignedOutPanel();
  if (typeof refreshLibraryFromSource === 'function') refreshLibraryFromSource();
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

document.getElementById('btn-account').addEventListener('click', openAccountModal);
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
