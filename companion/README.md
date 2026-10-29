# Learning Tree local companion

Run from the repository root:

```sh
npm ci --prefix companion
npm run companion
```

Open http://127.0.0.1:8765. Node.js 22+ is required. This service is local only;
model API keys and public hosting are unnecessary.

Full provider setup, recovery, limitations, and remaining account-side actions:
[assistant setup guide](../docs/assistant-setup.md).

Tests: `npm test --prefix companion` (simulated providers; no subscription use).
