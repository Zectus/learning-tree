/* ═══════════════════════════════════════════════════════════
   cloud.js — the only file that talks to Firebase directly.
   Sets up the app/auth/database once, then exposes a small
   surface (window.cloud) for everything else to call:
     cloud.signUp(email, password)
     cloud.signIn(email, password)
     cloud.signOutUser()
     cloud.getLibrary(uid)        → whole "My Trees" blob for this user
     cloud.setLibrary(uid, obj)   → overwrite it
   and calls window.handleCloudAuthChange(user) — defined in
   account.js — on every auth-state change, including once right
   after load with whatever session Firebase already had
   persisted, so account.js never has to poll for it.

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
   database's security rules, not by hiding this object. Fine to
   ship as-is in a static page with no backend of its own.
═══════════════════════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
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

window.cloud = {
  signUp:      (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signIn:      (email, password) => signInWithEmailAndPassword(auth, email, password),
  signOutUser: () => signOut(auth),

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
