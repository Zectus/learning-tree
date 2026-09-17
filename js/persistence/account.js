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

   GOOGLE SIGN-IN: unlike email/password sign-up, a Google account
   never goes through submitAccountForm, so there's no single place
   that already collects a username before the account exists. A
   brand-new Google sign-in can therefore land signed-in but with no
   username at all — pendingGoogleUser + the "choose a username" panel
   (showGoogleUsernamePanel/submitGoogleUsername) exist to close that
   gap right after the popup returns. openAccountModal's defensive
   re-check below also treats "signed in, no username, modal opened
   again later" as the same situation, so a Google user who closed
   that step early gets asked again instead of staying username-less
   forever.

   Depends on state.js (state.accountUser), library.js
   (refreshLibraryFromSource) and progress.js (refreshProgressFromSource)
   — signing in/out is what decides whether "My Trees" and per-node
   progress read from this browser or from the account's cloud copy, so
   every auth change re-triggers both.
═══════════════════════════════════════════════════════════ */

let accountMode = 'signin';
let authGeneration = 0;
let pendingGoogleUser = null; // set while the "choose a username" step is showing

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
   toolbar trigger label, the modal panel, and (via refreshLibraryFromSource
   / refreshProgressFromSource) which storage source "My Trees" and
   per-node progress read from. */
function applyAccountUser(user) {
  // Progress saves only mark a write as "pending" and wait for the tab
  // to close/hide before actually writing it anywhere, local or cloud
  // (see progress.js's write-batching block) — deliberately, to avoid
  // touching localStorage or the database on every quiz click. That
  // means a sign-out (or switching accounts) mid-session, with no
  // tab-close in between, would otherwise strand whatever's pending
  // under the account/source being left. flushProgress() reads
  // state.accountUser/progressSource synchronously the instant it's
  // called — before the reassignment on the next line — so calling it
  // here, first, sends that pending write to the outgoing source rather
  // than losing it or (worse) sending it to whichever one is about to
  // become current.
  if (typeof flushProgress === 'function') flushProgress();
  state.accountUser = user;
  updateAccountButton();
  if (user) showSignedInPanel(user); else showSignedOutPanel();
  if (typeof refreshLibraryFromSource === 'function') refreshLibraryFromSource();
  if (typeof refreshProgressFromSource === 'function') refreshProgressFromSource();
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
    // Covers two cases with one check: a slow username lookup from a
    // previous session that hadn't resolved yet, and a Google sign-in
    // that was closed before the username step below completed. Either
    // way, if a fresh lookup still comes back empty, let them claim one
    // right here instead of leaving the account permanently username-less.
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

// Turns a Google display name or email into a starting-point username —
// just a prefill the person can edit, not a guarantee it's available.
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
    case 'auth/popup-blocked':        return 'Your browser blocked the sign-in popup — allow popups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists for this email using a different sign-in method.';
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

/* Google sign-in has no separate "signup" mode — the same button
   signs an existing account in or creates a new one, and Firebase
   tells us which happened only indirectly (by whether a username
   already exists for that uid). If not, showGoogleUsernamePanel picks
   up right where submitAccountForm's signup branch would have. */
async function submitGoogleSignIn() {
  clearAccountError();
  if (!window.cloud) { showAccountError('Still connecting — try again in a moment.'); return; }
  const btn = document.getElementById('account-google-btn');
  btn.disabled = true;
  try {
    const user = await window.cloud.signInWithGoogle();
    const username = await window.cloud.getUsername(user.uid);
    if (username) {
      authGeneration++; // pre-empt the auth-listener's own slower lookup — see file header
      applyAccountUser({ uid: user.uid, email: user.email, username });
      closeAccountModal();
    } else {
      showGoogleUsernamePanel(user);
    }
  } catch (err) {
    // A closed/cancelled popup isn't a real error — the person just
    // changed their mind, nothing to show them.
    if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
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
document.getElementById('account-google-btn').addEventListener('click', submitGoogleSignIn);
document.getElementById('account-google-username-submit').addEventListener('click', submitGoogleUsername);
document.getElementById('account-signout-btn').addEventListener('click', submitSignOut);
document.getElementById('account-password-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitAccountForm(); });
document.getElementById('account-google-username-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitGoogleUsername(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('account-modal-backdrop').classList.contains('open')) closeAccountModal();
});

setAccountMode('signin');
