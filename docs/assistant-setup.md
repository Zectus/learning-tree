# Automatic lessons using your subscription

The implementation in this checkout is a **local companion**, not a hosted model
API service. You keep using a ChatGPT or Claude subscription. Select nodes in the
app, connect the provider, choose a model, and click **Generate selected lessons**.
The companion requests one complete lesson at a time and imports finished lessons
automatically. There is no prompt copying or lesson-file handling in this path.

The local companion is necessary because a static website cannot safely run a
local CLI or keep a background worker. The documented ChatGPT plan-usage flow
currently supports open-source/local clients; a paid or remotely hosted product
requires the separate provider onboarding described below.

## Start it

Requirements: Node.js 22 or newer, this repository, and an eligible provider
subscription. Use this checkout, which includes the companion changes. Once this
version has been published to the repository, a fresh clone will work too.

From the repository directory:

```sh
npm ci --prefix companion
npm run companion
```

Open **http://127.0.0.1:8765**. Keep the terminal process running. No Firebase
administrator key, model API key, remote server, or public tunnel is needed.
The companion binds only to `127.0.0.1`; do not put it behind a public reverse
proxy. Use the numeric host, not `localhost`, for the OAuth callback.

Optional configuration, set before launching:

- `LEARNING_TREE_COMPANION_PORT`: another local port, from 1024 through 65535.
  The callback uses that same port automatically. Update **Local app address** in
  the hosted app if you change it.
- `LEARNING_TREE_COMPANION_DATA`: a private directory for job checkpoints and the
  ChatGPT credential record. The default is
  `~/.local/share/learning-tree-companion` (under your user profile on Windows).
  Keep it outside the repository and outside any public/shared folder.

If you use a clone without dependencies for the normal static app, that is fine:
only `companion` dependencies are required to run this feature. Existing browser
account sync remains optional.

## Connect ChatGPT

1. In **Generate tree lessons**, choose **Automatic · use my subscription**.
2. Select **ChatGPT**, then **Continue with ChatGPT**.
3. Sign in on OpenAI's own page and authorize ChatGPT plan usage for **Learning
   Tree**. The companion never asks for your OpenAI password.
4. Return to the app. It loads the model catalog available to that account. Choose
   the model you want; model IDs and availability are not hardcoded.
5. Choose the node count and automatic/map selection, then click **Generate
   selected lessons**.

The first connection uses OpenAI's documented open-source dynamic registration:
`dynamic_agent_client`, a stable local host ID, PKCE, state, and an OIDC nonce. It
stores the *issued* client ID and verified identity, not the registration
placeholder. It verifies ID-token signatures, issuer, audience, expiry, and nonce,
and requires the returned ChatGPT plan-usage scopes. Returning sessions use
rotating refresh tokens. Credentials stay in a private local file and are never
returned to browser JavaScript, Firebase, the hosted app, or model prompts.

Requests use the public `/v1/responses` endpoint with subscription-authorized OAuth
credentials, `store: false`, and streaming completion. They do **not** use an API
key, a scraped ChatGPT session cookie, ChatGPT's private backend endpoints, or a
paid API fallback. The companion waits for `response.completed` before saving.
Reasoning settings unsupported by a chosen model cause a visible failure; use
**Provider default** or a supported setting and create a new job.

**Provider-dependent placeholder: live account verification.** The OAuth and
streaming implementation has been tested with simulated provider responses, but
this environment cannot complete your personal sign-in. If your account does not
expose the documented OSS plan-usage flow or declines these scopes, the UI reports
the problem and keeps existing lessons. Do not substitute an API key. Check the
linked official documentation for current eligibility/rollout details.

**Disconnect ChatGPT** pauses any running ChatGPT job, attempts to revoke its
renewable session at OpenAI's advertised revocation endpoint, and removes the
local tokens. If remote revocation cannot be confirmed, the UI tells you; revoke
Learning Tree in ChatGPT settings as well. The app keeps a token-free registration
record and the host ID for later sign-in. To switch, choose a saved registration
or **Add a ChatGPT account**, then **Continue with ChatGPT**. A new connection
becomes active only after validation. Saved jobs stay bound to their original
account/registration, which can be selected again for resume.

## Connect Claude

Install the official [Claude Code CLI](https://code.claude.com/docs/en/setup), then
run this in your terminal once:

```sh
claude auth login
claude auth status
```

Choose your **Claude subscription**, not Anthropic Console or API billing. In the
app select **Claude Code**, then **Refresh connection**. Choose **Opus** or
**Sonnet**. The official CLI resolves those aliases to versions available to you.

The companion invokes `claude -p` with the prompt on standard input and captures
its JSON result. A teaching-specific system prompt replaces the coding-oriented
default for these requests. It never reads Claude's credential files or sends Claude OAuth
tokens to an API. Shell execution and model tools are disabled. Per-project hooks,
settings, session persistence, and shared MCP configurations are excluded from
these lesson-only runs. It deliberately does **not** use `--bare`, because the
current CLI documentation says bare mode skips subscription credentials.

It excludes API-key, direct bearer-token, third-party-provider, and alternate API
endpoint environment variables, and checks that `claude auth status` reports the
`claude.ai` authentication method. Unknown or API-billed methods are rejected.
Keep the CLI updated if its supported flags or authentication metadata change.

**User setup placeholder: install/sign in locally.** I cannot install Claude Code
on your personal computer or authorize your subscription for you. Those two
terminal commands are the only Claude-specific account setup required here.

## Bring the tree from the hosted app

On the ordinary hosted app, select **Automatic · use my subscription**, start the
companion on your computer, then click **Open local app with this tree**.

The local tab asks you to confirm the source and accept the tree. It receives the
structure, existing lesson text, selected node IDs/count, and lesson language.
It does not transfer Firebase credentials, quiz answers, notes, or completion
flags. They remain in the original tab/account. Confirm the batch and generate.
Finished lesson records automatically return to the original tab while both tabs
remain open, and merge without changing that tab's answers, notes, completion, or
library identity.

The transfer uses exact origins, the expected window reference, and a fresh nonce.
There is no cross-origin access to the local HTTP API and no background scan of
your private network. Popups must be allowed for the handoff and ChatGPT sign-in.
If you change trees in the original tab, results are not applied to the wrong
tree. If you close it, the local job is still safe; reopen its tree locally or use
the ordinary JSONL import as a recovery option.

## What happens when a job stops

- The companion keeps running if you close a browser tab. The computer must stay
  awake and the terminal process must stay alive.
- Each complete, structurally valid lesson is checkpointed to disk **before** the
  next lesson begins. No final all-or-nothing file is required.
- **Pause** cancels the in-progress lesson; earlier lessons stay saved.
- A network error, usage limit, incomplete response, or invalid question markup
  stops the job visibly. It does not keep retrying and consuming your allowance.
- **Resume** retries only missing nodes with the job's original model, effort,
  prompts, and account. To change those choices, create a new batch.
- After a companion restart, previously running jobs are paused until you resume.
- Open **Generate tree lessons** to see saved jobs, including with an empty map.
  **Open job tree** first saves the current tree to My Trees, then restores the
  job's original tree and baseline lessons plus finished outputs. Quiz progress
  remains managed by the app's existing progress storage.
- **Delete job** removes an old local checkpoint after confirmation; it does not
  remove lessons already imported into a tree. Pause a running job first.
- **Download saved lessons** is an independent recovery/export option. The
  resulting JSONL is compatible with the existing importer.

Structural validation checks lesson headings, closed blocks, question numbering,
answer keys, and options. It does not certify the physics or teaching quality.
Every node gets the current full teaching prompt and exact prerequisite context.
The companion never chooses a cheaper model or shortens a lesson to fit a batch.
Batches are limited to 250 nodes and 32 MB of request data. A model request has a
30-minute safety timeout; an interrupted node can be resumed.

Subscription allowances still apply. Some providers offer **paid extra usage**
after the included allowance; disable that setting in your provider account if
you want a strict subscription-only budget. Using subscription credentials alone
cannot override the provider's account-level extra-usage setting.

## Local storage and troubleshooting

`jobs.json` contains immutable job prompts, tree snapshots, and completed lessons.
`chatgpt.json` contains the active ChatGPT credential record. `host.json` contains
the stable host identifier. `registrations.json` keeps token-free account/client
mappings so a disconnected account can be reauthorized without losing its job identity. Unix directories use `0700` and files use `0600`;
Windows users should keep the data under their private user profile. Writes use a
private temporary file, flush, and atomic rename. Back up this directory securely
if the lesson journal matters to you; do not commit it.

Only one companion process may use a data directory. If it says it is already
running, use the existing window/process. After an abnormal shutdown, a stale
lock is reclaimed if its recorded process no longer exists. If a lock is corrupt,
first confirm no companion is running before deleting `companion.lock` from the
data directory. Never delete credential/job files just to fix a busy port.

If sign-in succeeds but the app does not refresh, return to its tab and click
**Refresh connection**; browser popup isolation can prevent an automatic callback
notification. If Claude is not detected, check that `claude` is on the PATH of the
terminal running the companion and update the official CLI.

Local Firebase sync may require adding `127.0.0.1` to Firebase Authentication's
**Settings → Authorized domains** for project `learning-tree-6db88`. This is
optional: generation works without Firebase sign-in, and the hosted-tab handoff
preserves the original account's sync. I cannot change that Firebase setting from
this environment because no project administration credentials are attached.

## Why not only a remote ChatGPT/Claude connector?

Remote MCP remains a good route for generating *inside* a subscription chat.
However, the current ChatGPT help page limits custom MCP write access on some
personal plans, and chat integrations may ask for action confirmations or require
Continue messages. The local companion provides the fully automatic, one-node-at-
a-time worker without depending on those write permissions.

OpenAI also documents direct ChatGPT plan usage for OSS/local apps. The broader
**Sign in with ChatGPT** partner flow and paid/remotely hosted use have separate
onboarding. A production hosted version should use an approved registration and
server-side credential storage; do not publicly deploy this loopback companion.
Claude's local subscription path uses the official CLI rather than an invented
third-party subscription API.

## Optional future hosted setup — explicit placeholders

These are **not required for the local workflow implemented here**:

1. `[APPROVED_HOSTED_CHATGPT_CLIENT]`: complete OpenAI's
   [Sign in with ChatGPT onboarding](https://developers.openai.com/siwc/request-client-id)
   / the interest form linked from the
   [OSS plan-usage overview](https://developers.openai.com/siwc/token-sharing-open-source)
   if you want to offer direct plan usage from a remotely hosted service.
2. `[PUBLIC_BACKEND_ORIGIN]`, `[SECRET_STORAGE]`, `[DURABLE_JOB_STORAGE]`: provision
   a separately designed hosted backend once that access is approved. This
   checkout intentionally does not contain a public multi-user deployment of the
   local OAuth worker.
3. `[CLAUDE_REMOTE_CONNECTOR]`: if you prefer running inside Claude web, deploy an
   authenticated remote MCP job bridge and add it in Claude's connector settings.
   That is a different integration; no pretend endpoint is enabled in this app.
4. `[PUBLISHED_APP_VERSION]`: publish/push this checkout's changes through your
   normal repository/site workflow before expecting the new controls on the
   existing public site. No production deployment or provider account settings
   were changed from this environment.

## Official references checked for this implementation

Checked 2026-10-28; provider availability and UI labels can change.

- [ChatGPT plan usage for OSS/local apps](https://developers.openai.com/siwc/token-sharing-open-source)
- [Registration, scopes, PKCE, and identity validation](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Account sessions and token refresh](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Available models and subscription-backed inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Current preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [Claude Code subscription authentication](https://code.claude.com/docs/en/authentication)
- [Claude Code programmatic CLI](https://code.claude.com/docs/en/headless)
- [Claude Code CLI flags](https://code.claude.com/docs/en/cli-reference)
- [ChatGPT custom MCP access and current plan restrictions](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

## Remaining steps for you

- `[YOUR_LOCAL_CHECKOUT]`: use this checkout on your own computer and run
  `npm ci --prefix companion`, then `npm run companion`.
- `[YOUR_CHATGPT_CONSENT]`: click **Continue with ChatGPT** and authorize plan
  usage. Real account eligibility cannot be verified without your sign-in.
- `[YOUR_CLAUDE_LOGIN]` (only if using Claude): install the official CLI, run
  `claude auth login`, then refresh the connection in the app.
- `[YOUR_BUDGET_SETTING]`: disable provider-side paid extra usage if you want to
  stop strictly at your included subscription allowance.
- `[PUBLISHED_APP_VERSION]` (only for the existing public site): publish this
  checkout through the repository/site workflow. The local app already serves
  this version directly; no hosted backend is needed for it.
- `[FIREBASE_LOCAL_DOMAIN]` (optional sync): add `127.0.0.1` to authorized domains
  if you want Firebase sign-in in the local tab and it reports an unauthorized
  domain. Generation and hosted-tab return work without this change.
