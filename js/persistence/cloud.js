/* Firebase boundary. Progress uses field-level updates against the last loaded
   snapshot; library writes use per-entry transactions and reject stale edits.
   Existing /users/{uid} ownership rules cover both. Legacy data is retained.
   Provider linking preserves the Firebase UID and its stored learning data. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  linkWithPopup,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  runTransaction,
  update,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHyxfQRjMa8-hGTuuJQvEp3qMGmqP5G20",
  authDomain: "learning-tree-6db88.firebaseapp.com",
  databaseURL: "https://learning-tree-6db88-default-rtdb.firebaseio.com",
  projectId: "learning-tree-6db88",
  storageBucket: "learning-tree-6db88.appspot.com",
  messagingSenderId: "364662376071",
  appId: "1:364662376071:web:f79e6eb4b6d075e216da22",
  measurementId: "G-NT9NTSVQHC",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

/* Google sign-in creates the Firebase account automatically on first use —
   there's no separate "sign up" step the way email/password has one. What
   it does NOT give us for free is a claimed username (see claimUsername
   above): a brand-new Google user has an auth record but no /users/{uid}/
   username yet. account.js checks for that after this resolves and, if
   missing, shows an inline "choose a username" step before treating the
   sign-in as fully complete — same uniqueness guarantee as the
   email/password path, just triggered from a different place. */
let pendingGoogleCredential = null, pendingGoogleEmail = null;
async function signInWithGoogle() {
  let result;
  try { result = await signInWithPopup(auth, googleProvider); }
  catch (error) {
    if (error.code === 'auth/account-exists-with-different-credential') {
      pendingGoogleCredential = GoogleAuthProvider.credentialFromError(error);
      pendingGoogleEmail = error.customData?.email;
    }
    throw error;
  }
  const u = result.user;
  return { uid: u.uid, email: u.email, displayName: u.displayName || '' };
}

async function claimUsername(uid, username) {
  const key = username.toLowerCase();
  const result = await runTransaction(ref(db, `usernames/${key}`), current => {
    if (current !== null && current !== uid) return; // already claimed — returning undefined aborts the transaction, no write happens
    return uid;
  });
  if (!result.committed) return false;
  await set(ref(db, `users/${uid}/username`), username); // display casing, separate from the lowercase uniqueness key above
  return true;
}

const cloudBaselines = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, comparable(value[key])]));
  return value;
}
const sameValue = (a, b) => JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
function diffFields(before, after, prefix = '', out = {}) {
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
    const path = prefix ? prefix + '/' + key : key;
    const a = before?.[key], b = after?.[key];
    if (sameValue(a, b)) continue;
    if (b === undefined) out[path] = null;
    else if (b && typeof b === 'object' && !Array.isArray(b)) diffFields(a, b, path, out);
    else out[path] = b;
  }
  return out;
}
async function readCollection(uid, collection) {
  const snap = await get(ref(db, `users/${uid}/${collection}`));
  const value = snap.exists() ? snap.val() : {};
  cloudBaselines.set(uid + '/' + collection, clone(value));
  return value;
}
async function writeCollection(uid, collection, value) {
  const key = uid + '/' + collection;
  if (!cloudBaselines.has(key)) throw new Error('Load account data before saving.');
  const snapshot = clone(value);
  const before = cloudBaselines.get(key);
  if (collection === 'library') {
    for (const id of new Set([...Object.keys(before), ...Object.keys(snapshot)])) {
      if (sameValue(before[id], snapshot[id])) continue;
      const result = await runTransaction(ref(db, `users/${uid}/library/${id}`), current => {
        if (!sameValue(current, before[id] || null)) return;
        return snapshot[id] || null;
      }, { applyLocally: false });
      if (!result.committed) throw new Error('This saved tree changed on another device. Reopen My Trees before editing it again.');
      // Advance only committed entries, so a partial failure can be retried.
      if (snapshot[id]) before[id] = clone(snapshot[id]); else delete before[id];
    }
    return;
  }
  const changes = diffFields(before, snapshot);
  if (Object.keys(changes).length) await update(ref(db, `users/${uid}/${collection}`), changes);
  cloudBaselines.set(key, snapshot);
}
window.cloud = {
  signUp:      (email, password) => createUserWithEmailAndPassword(auth, email, password),
  async signIn(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (pendingGoogleCredential && result.user.email?.toLowerCase() === pendingGoogleEmail?.toLowerCase()) {
      await linkWithCredential(result.user, pendingGoogleCredential);
      pendingGoogleCredential = null;
      pendingGoogleEmail = null;
    }
    return result;
  },
  addPassword: password => linkWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password)),
  linkGoogle: () => linkWithPopup(auth.currentUser, googleProvider),
  resetPassword: email => sendPasswordResetEmail(auth, email),
  signOutUser: () => signOut(auth),
  deleteCurrentUser: () => (auth.currentUser ? deleteUser(auth.currentUser) : Promise.resolve()),
  signInWithGoogle,

  claimUsername,
  async getUsername(uid) {
    const snap = await get(ref(db, `users/${uid}/username`));
    return snap.exists() ? snap.val() : null;
  },

  /* Whole-library reads/writes — same {id: {name, savedAt, data}} shape as
     the localStorage 'tree-library' blob library.js already knows how to
     render (see LIBRARY_KEY there), just living under this user's own uid
     in the database instead of in this one browser. */
  getLibrary: uid => readCollection(uid, 'library'),
  setLibrary: (uid, value) => writeCollection(uid, 'library', value),

  /* Whole-progress reads/writes — same {signature: {label: record}} shape
     as the localStorage 'tree-progress' blob (see PROGRESS_KEY in
     progress.js), just living under this user's own uid instead of in
     this one browser. Keys are pre-sanitized by progress.js before ever
     reaching here — see this file's header for why that has to happen
     on that side, not this one. */
  getProgress: uid => readCollection(uid, 'progress'),
  setProgress: (uid, value) => writeCollection(uid, 'progress', value),
};

onAuthStateChanged(auth, user => {
  if (typeof window.handleCloudAuthChange === 'function') window.handleCloudAuthChange(user);
});
