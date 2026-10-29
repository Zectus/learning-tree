# Online lesson generation

The hosted Learning Tree bridge uses Sites sign-in and private per-user R2 storage.
Its ChatGPT plugin reads queued teaching prompts and saves finished lessons. It
makes no model API requests and needs no local installation or provider API key.

Live site: https://learning-tree-lessons.zectusone.chatgpt.site

Normal user flow:
1. Select lessons on the Learning Tree website and choose ChatGPT online.
2. Continue to the online page and prepare the selected batch.
3. In ChatGPT, select the Learning Tree plugin and ask it to generate the queued
   lessons. The assistant saves each finished lesson directly; both browser pages
   show progress and the original tree receives the text automatically.

The assistant run still needs to be started in ChatGPT. This is subscription chat
usage, not fully unattended inference initiated by a static website. Model choice,
usage limits, and any action confirmations stay in ChatGPT. No tokens, credentials,
notes, answers, or completion flags are transferred from the source app.

New Sites are private to their owner. The public Learning Tree UI remains public;
this initial hosted integration is for its owner to test. Making it available to
other users requires explicitly sharing/publishing the Site and plugin for that
audience. Do not silently change its access policy.

Source here is mirrored into the Site's source repository. The tracked Site ID
and storage/MCP manifest are in hosting.json. Build by copying generation-format.js
from js/learn into the Site checkout and running build.mjs with that directory.
The artifact has dist/server/index.js and .openai/hosting.json; the deployment
archive includes the dist directory, not only its children.

Only authenticated, user-scoped MCP tools can read or write jobs. Existing lessons
cannot be overwritten; writes are conditional and idempotent. Job input is an
immutable tree snapshot, selected queue, and exact per-node teaching prompts.
Lesson files use the same structural validator and tree identity as browser imports.
A browser accepts handoff/result messages only from the expected window, origin,
and fresh nonce. Results are resent until the original tab acknowledges individual
node IDs, so independent branches can finish in any order without skipping a lesson.
