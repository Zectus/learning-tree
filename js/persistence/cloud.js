/* ═══════════════════════════════════════════════════════════
   cloud.js — the only file that talks to Firebase directly.
   Sets up the app/auth/database once, then exposes a small
   surface (window.cloud) for everything else to call:
     cloud.signUp(email, password)      → resolves with the UserCredential
     cloud.signIn(email, password)
     cloud.signOutUser()
     cloud.claimUsername(uid, username) → true if claimed, false if taken
     cloud.getUsername(uid)             → this user's claimed username, or null
     cloud.deleteCurrentUser()          → used to roll back a signup whose
                                           chosen username turned out taken
     cloud.getLibrary(uid)              → whole "My Trees" blob for this user
     cloud.setLibrary(uid, obj)         → overwrite it
   and calls window.handleCloudAuthChange(user) — defined in
   account.js — on every auth-state change, including once right
   after load with whatever session Firebase already had
   persisted, so account.js never has to poll for it.

   USERNAME UNIQUENESS: real email/password auth (unlike the
   username-as-fake-email trick this was adapted from) doesn't
   give username uniqueness for free, so this reserves one
   explicitly at /usernames/{lowercased} via a transaction that
   only succeeds if that key doesn't already hold a uid — the
   Realtime Database equivalent of an atomic "insert if absent."
   /users/{uid}/username stores the *display* casing separately,
   since that's what's actually shown; the lowercase index exists
   purely to make collisions impossible regardless of casing.

   Loaded as a module (see index.html) so it can use Firebase's
   ES-module SDK straight from the CDN, same as the file these
   credentials were copied from. Module scripts always execute
   after every classic <script> on the page has already run,
   regardless of tag order — so it's safe for this file to assume
   account.js and library.js have already defined everything it
   calls into by the time this runs.

   The apiKey/appId/etc. below are the client-side Firebase config
   for this project — these are not secrets (Firebase's own docs
   are explicit about this); access is actually controlled by the
   database's security rules, not by hiding this object.

   ⚠ This introduces a new top-level /usernames path alongside the
   existing /users path — your database rules need to allow an
   authenticated user to read any /usernames/{key} (to check
   availability) and write only a key that doesn't already exist,
   e.g.:
     "usernames": {
       "$key": {
         ".read": "auth != null",
         ".write": "auth != null && !data.exists() && newData.val() === auth.uid"
       }
     }
═══════════════════════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  runTransaction,
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

async function claimUsername(uid, username) {
  const key = username.toLowerCase();
  const result = await runTransaction(ref(db, `usernames/${key}`), current => {
    if (current !== null) return; // already claimed — returning undefined aborts the transaction, no write happens
    return uid;
  });
  if (!result.committed) return false;
  await set(ref(db, `users/${uid}/username`), username); // display casing, separate from the lowercase uniqueness key above
  return true;
}

window.cloud = {
  signUp:      (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signIn:      (email, password) => signInWithEmailAndPassword(auth, email, password),
  signOutUser: () => signOut(auth),
  deleteCurrentUser: () => (auth.currentUser ? deleteUser(auth.currentUser) : Promise.resolve()),

  claimUsername,
  async getUsername(uid) {
    const snap = await get(ref(db, `users/${uid}/username`));
    return snap.exists() ? snap.val() : null;
  },

  /* Whole-library reads/writes — same {id: {name, savedAt, data}} shape as
     the localStorage 'tree-library' blob library.js already knows how to
     render (see LIBRARY_KEY there), just living under this user's own uid
     in the database instead of in this one browser. */
  async getLibrary(uid) {
    const snap = await get(ref(db, `users/${uid}/library`));
    return snap.exists() ? snap.val() : {};
  },
  async setLibrary(uid, libraryObj) {
    await set(ref(db, `users/${uid}/library`), libraryObj);
  },
};

onAuthStateChanged(auth, user => {
  if (typeof window.handleCloudAuthChange === 'function') window.handleCloudAuthChange(user);
});
