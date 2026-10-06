# learning-tree

A prerequisite-tree learning app. You build (or generate) a tree of topics where each node unlocks once its prerequisites are done; each node becomes a generated lesson with quiz questions; progress, notes and saved trees can sync to an account.

Static site, no build step. Firebase (auth + realtime database) is used only for optional account sync.

## Running it

Serve the folder over http — opening `index.html` straight from disk (`file://`) won't work fully, because browsers refuse to load the ES-module `js/persistence/cloud.js` from `file://`, so sign-in and sync are dead. Everything else still works offline.

```sh
python3 -m http.server 8000     # or any static server
# then open http://localhost:8000
```

## How it's used

1. **Tree ▾ → New tree** gives you a prompt to paste into Claude (from a topic, or with a file attached). Upload the `.json` it produces.
2. Click an available node: **the learn modal** gives you a prompt for that node's lesson. Upload the `.txt` it produces to open the session viewer and answer the questions.
3. **📚 My Trees** saves whole trees (with their lessons) in this browser, or in your account when signed in.

Lesson files mark each question's correct option inline with `[ANSWER: X]`.

## Layout

```
index.html            page shell, modals, and the script load order
css/                  one stylesheet per area; theme.css holds every colour/variable
js/core/              scale, state, layout, escape-key stack, toasts, modal focus handling
js/graph/             nodes, viewport (pan/zoom), toolbar
js/learn/             prompt templates + builders, lesson viewer, content-block tools (tables/timelines/graphs)
js/persistence/       tree JSON import/export, progress, saved-tree library, account, Firebase (cloud.js)
js/lib/               autoscroll (middle-click)
scripts/              one-off maintenance scripts
test/                 node:test suite (runs the real index.html + scripts in jsdom)
```

Scripts are plain classic scripts sharing globals, loaded in the order listed in `index.html`; each file's header comment says what it depends on.

## Tests

```sh
npm install
npm test
```

The suite loads `index.html` and every app script into jsdom in page order, so it exercises the real wiring (DOM ids, script order, handlers) rather than isolated copies of the functions.

## Firebase

`js/persistence/cloud.js` contains the project's client config. That config is not a secret; what protects the data is the database's security rules. They should restrict `users/$uid` to `auth.uid === $uid` and allow `usernames/$key` to be written only when it doesn't already exist (see the header of `cloud.js`).

Storage and account linking:

- Guest trees and progress migrate from localStorage to IndexedDB after a successful transaction. Browser quotas still apply; blocked/unavailable IndexedDB is reported, and browsers without IndexedDB use the previous localStorage fallback.
- Exported JSON now carries `treeId` and per-node `progressId`. Older files still load; their root signature supplies a repeatable initial tree ID, and existing label-based progress remains readable. Save/export once to preserve IDs before changing root labels. Old files with identical root signatures remain ambiguous until assigned separate identities.
- Firebase paths remain under `/users/{uid}/library` and `/users/{uid}/progress`. The existing owner-only rules supplied for this project already authorize these paths; no rules deployment is required. Legacy progress remains available during gradual migration. Do not run an old deployed client alongside the new client indefinitely: old clients still overwrite entire collections.
- Progress writes patch changed fields; concurrent changes to different fields survive. Explicit changes to the same field use last-write-wins. Library edits use transactions per entry and report a conflict when another device changed that entry. Reopen My Trees to reload before retrying. Cloud saves require connectivity; a failed progress save stays pending in this tab, but closing it before a retry can lose that pending edit.
- Enable both Google and Email/Password in Firebase Authentication, use “one account per email address,” and configure the deployment's authorized domain. Google signup offers an optional email password. Existing Google users can add it from Account. Email users can connect Google while signed in. When Google reports an existing account using another provider, sign in with the existing password to link the pending Google credential. Linking keeps the same UID, username, trees, and progress. A matching email alone never authorizes client-side merging of two existing UIDs.
- Validate Google popup, existing-provider linking, and IndexedDB migration in a real browser against a Firebase staging project before release. Automated tests mock the Firebase boundary and do not contact production.
