/* ═══════════════════════════════════════════════════════════
   account.js — the sign up / sign in / signed-in account modal. It owns
   nothing Firebase-specific: it only calls window.cloud.* (cloud.js, a
   module that runs after this file — see index.html) and reacts to auth
   changes through window.handleCloudAuthChange, which this file defines and
   cloud.js calls on every change, including once at load with any persisted
   session.

   TOOLBAR: "👤 …" (#btn-account-menu) is a dropdown trigger whose label shows
   the signed-in identity, like the Mode trigger shows the mode; the
   #menu-account item inside that dropdown opens this modal.

   USERNAME DISPLAY has two race conditions to keep in mind:
   1. On sign-up, onAuthStateChanged fires the instant the account exists —
      before claimUsername() has written anything — so handleCloudAuthChange
      sees no username and falls back to email. The uid never changes again,
      so that listener won't fire a second time; submitAccountForm therefore
      updates state.accountUser itself as soon as the claim succeeds.
   2. onAuthStateChanged can fire several times in quick succession, each
      starting an async getUsername() that may resolve out of order.
      authGeneration is an "ignore me if a newer call has started" guard.

   GOOGLE SIGN-IN never goes through submitAccountForm, so nothing has
   collected a username before the account exists. pendingGoogleUser and the
   "choose a username" panel close that gap right after the popup returns;
   openAccountModal re-checks so a Google user who closed that step early is
   asked again instead of staying username-less.

   Depends on state.js, escape.js, library.js (refreshLibraryFromSource) and
   progress.js (refreshProgressFromSource, flushProgress): signing in/out
   decides whether "My Trees" and progress read from this browser or the
   account's cloud copy.
═══════════════════════════════════════════════════════════ */

let accountMode = 'signin';
let authGeneration = 0;
let pendingGoogleUser = null; // set while the "choose a username" step is showing

function setAccountMode(mode) {
  accountMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('account-username-row').classList.toggle('hidden', !isSignup);
  document.getElementById('account-modal-title').textContent = isSignup ? 'Create an account' : 'Sign in';
  document.getElementById('account-submit-btn').textContent  = isSignup ? 'Sign up' : 'Sign in';
  document.getElementById('account-toggle-text').textContent = isSignup ? 'Already have an account? ' : "Don't have an account? ";
  document.getElementById('account-toggle-btn').textContent  = isSignup ? 'Sign in' : 'Sign up';
  // Tells password managers whether to offer a saved password or suggest a new one.
  document.getElementById('account-password-input').autocomplete = isSignup ? 'new-password' : 'current-password';
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

/* Applies a signed-in/out user everywhere it's shown: the toolbar trigger, the
   modal panel, and (via refreshLibraryFromSource / refreshProgressFromSource)
   which storage source "My Trees" and progress read from. */
function applyAccountUser(user) {
  // Progress writes only go out when the tab hides or closes (see progress.js),
  // so switching accounts mid-session would strand whatever is pending under
  // the outgoing one. flushProgress() reads state.accountUser synchronously, so
  // calling it before the reassignment below sends the write to the outgoing
  // source. (An explicit sign-out flushes earlier still — see submitSignOut —
  // because by the time this runs for a sign-out, auth is already revoked.)
  if (typeof flushProgress === 'function') flushProgress();
  const sourceChanged = state.accountUser?.uid !== user?.uid;
  state.accountUser = user;
  updateAccountButton();
  if (user) showSignedInPanel(user); else showSignedOutPanel();
  if (sourceChanged && typeof refreshLibraryFromSource === 'function') refreshLibraryFromSource().catch(() => showToast('Could not load saved trees.'));
  if (sourceChanged && typeof refreshProgressFromSource === 'function') refreshProgressFromSource().catch(() => showToast('Could not load progress.'));
}

/* Opens the modal. If we're signed in but have no username yet — a slow lookup
   from a previous session, or a Google sign-in closed before the username step
   finished — look it up again, and if there still isn't one, let them claim
   one right here instead of leaving the account permanently username-less. */
function openAccountModal() {
  document.getElementById('account-modal-backdrop').classList.add('open');
  if (state.accountUser && !state.accountUser.username && window.cloud) {
    window.cloud.getUsername(state.accountUser.uid).then(username => {
      if (!state.accountUser) return;
      if (username) {
        state.accountUser.username = username;
        updateAccountButton();
        showSignedInPanel(state.accountUser);
      } else {
        showGoogleUsernamePanel({ uid: state.accountUser.uid, email: state.accountUser.email, displayName: '' });
      }
    }).catch(() => {});
  }
}
function closeAccountModal() {
  document.getElementById('account-modal-backdrop').classList.remove('open');
  pendingGoogleUser = null;
  document.getElementById('account-google-username-panel').classList.add('hidden');
  if (!state.accountUser) document.getElementById('account-form-panel').classList.remove('hidden');
}

function showSignedOutPanel() {
  document.getElementById('account-form-panel').classList.remove('hidden');
  document.getElementById('account-google-username-panel').classList.add('hidden');
  document.getElementById('account-signed-in-panel').classList.add('hidden');
  document.getElementById('account-modal-meta').textContent = 'sign in to sync your trees across devices';
}
function showSignedInPanel(user) {
  document.getElementById('account-form-panel').classList.add('hidden');
  document.getElementById('account-google-username-panel').classList.add('hidden');
  document.getElementById('account-signed-in-panel').classList.remove('hidden');
  document.getElementById('account-name-display').textContent = user.username || user.email;
  document.getElementById('account-email-line').textContent = user.username ? user.email : '';
  document.getElementById('account-email-line').classList.toggle('hidden', !user.username);
  document.getElementById('account-modal-meta').textContent = 'your trees are synced to this account';
}

// A Google display name or email as a starting-point username — a prefill, not a guarantee it's free.
function suggestUsernameFrom(seed) {
  let base = String(seed || '').split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
  if (base.length < 3) base += Math.random().toString(36).slice(2, 5);
  return base.slice(0, 20);
}

function showGoogleUsernamePanel(user) {
  pendingGoogleUser = user;
  clearAccountError();
  document.getElementById('account-form-panel').classList.add('hidden');
  document.getElementById('account-signed-in-panel').classList.add('hidden');
  document.getElementById('account-google-username-panel').classList.remove('hidden');
  document.getElementById('account-modal-title').textContent = 'Choose a username';
  const input = document.getElementById('account-google-username-input');
  input.value = suggestUsernameFrom(user.displayName || user.email);
  input.focus();
}

/* Updates the dropdown TRIGGER's label (visible without opening the menu). The
   #menu-account item inside stays static. */
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

/* The hook cloud.js calls (via onAuthStateChanged) whenever the signed-in user
   changes, including once after page load with any persisted session. */
window.handleCloudAuthChange = async function (user) {
  const gen = ++authGeneration;
  if (!user) {
    applyAccountUser(null);
    return;
  }
  let username = null;
  try { username = await window.cloud.getUsername(user.uid); } catch {}
  if (gen !== authGeneration) return; // a newer auth event superseded this one
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
    case 'auth/popup-blocked':        return 'Your browser blocked the sign-in popup — allow popups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'Sign in with the existing email and password to connect Google to that same account.';
    case 'auth/provider-already-linked': return 'This sign-in method is already connected.';
    case 'auth/requires-recent-login': return 'Sign out and sign in again, then retry connecting this sign-in method.';
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
      let claimed = false;
      try {
        claimed = await window.cloud.claimUsername(cred.user.uid, username);
      } catch (err) {
        // The claim itself failed (network, database rules): don't leave a username-less account behind.
        await window.cloud.deleteCurrentUser().catch(() => {});
        throw err;
      }
      if (!claimed) {
        await window.cloud.deleteCurrentUser(); // taken: roll the account back too
        showAccountError('That username is already taken — try another.');
        return;
      }
      // onAuthStateChanged already fired, before this claim existed, and cached a
      // null username (see the header); apply the known-good state directly.
      authGeneration++; // invalidate that earlier lookup if it's still in flight
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

/* Google has no separate "sign up": the same button signs in or creates the
   account, and the only tell is whether a username already exists for that uid. */
async function submitGoogleSignIn() {
  clearAccountError();
  if (!window.cloud) { showAccountError('Still connecting — try again in a moment.'); return; }
  const btn = document.getElementById('account-google-btn');
  btn.disabled = true;
  try {
    const user = await window.cloud.signInWithGoogle();
    const username = await window.cloud.getUsername(user.uid);
    if (username) {
      authGeneration++; // pre-empt the auth listener's own slower lookup
      applyAccountUser({ uid: user.uid, email: user.email, username });
      closeAccountModal();
    } else {
      showGoogleUsernamePanel(user);
    }
  } catch (err) {
    // A closed/cancelled popup means they changed their mind — nothing to report.
    if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
      if (err?.code === 'auth/account-exists-with-different-credential') {
        setAccountMode('signin');
        document.getElementById('account-email-input').value = err.customData?.email || '';
      }
      showAccountError(friendlyAuthError(err));
    }
  } finally {
    btn.disabled = false;
  }
}

async function submitGoogleUsername() {
  const username = document.getElementById('account-google-username-input').value.trim();
  clearAccountError();
  if (!isValidUsername(username)) {
    showAccountError('Usernames are 3–20 characters: letters, numbers, underscores, or hyphens.');
    return;
  }
  if (!pendingGoogleUser) return;
  const btn = document.getElementById('account-google-username-submit');
  btn.disabled = true;
  try {
    const password = document.getElementById('account-google-password').value;
    if (password) { await window.cloud.addPassword(password); document.getElementById('account-google-password').value = ''; }
    const claimed = await window.cloud.claimUsername(pendingGoogleUser.uid, username);
    if (!claimed) { showAccountError('That username is already taken — try another.'); return; }
    authGeneration++;
    applyAccountUser({ uid: pendingGoogleUser.uid, email: pendingGoogleUser.email, username });
    pendingGoogleUser = null;
    document.getElementById('account-google-username-input').value = '';
    closeAccountModal();
  } catch (err) {
    showAccountError(friendlyAuthError(err));
  } finally {
    btn.disabled = false;
  }
}

async function submitSignOut() {
  if (!window.cloud) return;
  // Flush while still authenticated: once signOutUser() resolves the database
  // rejects writes, and the flush in applyAccountUser would be too late.
  if (typeof flushProgress === 'function') await flushProgress();
  try { await window.cloud.signOutUser(); } catch {}
  closeAccountModal();
}

document.getElementById('account-add-password-btn').addEventListener('click', async () => {
  clearAccountError();
  const input = document.getElementById('account-add-password');
  try { await window.cloud.addPassword(input.value); input.value = ''; showToast('Email sign-in is now connected to this account.'); }
  catch (error) { showAccountError(friendlyAuthError(error)); }
});
document.getElementById('account-link-google-btn').addEventListener('click', async () => {
  clearAccountError();
  try { await window.cloud.linkGoogle(); showToast('Google is now connected to this account.'); }
  catch (error) { showAccountError(friendlyAuthError(error)); }
});
document.getElementById('menu-account').addEventListener('click', openAccountModal);
document.getElementById('account-modal-close').addEventListener('click', closeAccountModal);
document.getElementById('account-modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('account-modal-backdrop')) closeAccountModal();
});
document.getElementById('account-toggle-btn').addEventListener('click', () => setAccountMode(accountMode === 'signin' ? 'signup' : 'signin'));
document.getElementById('account-submit-btn').addEventListener('click', submitAccountForm);
document.getElementById('account-google-btn').addEventListener('click', submitGoogleSignIn);
document.getElementById('account-google-username-submit').addEventListener('click', submitGoogleUsername);
document.getElementById('account-signout-btn').addEventListener('click', submitSignOut);
document.getElementById('account-password-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitAccountForm(); });
document.getElementById('account-google-username-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitGoogleUsername(); });
onEscape(100, () => {
  if (!document.getElementById('account-modal-backdrop').classList.contains('open')) return false;
  closeAccountModal();
  return true;
});

setAccountMode('signin');
