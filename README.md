# Alongside JavaScript SDK

Keep this document brief and current. Link to detail instead of duplicating it.

A framework-independent TypeScript browser SDK. Websites report facts through `track(name, properties)`; the SDK manages session identity and delivery to the backend. Travel-specific events and UI belong to the integrating website.

**Status:** formatting is configured; source and tests are empty placeholders. The runtime API, TypeScript build and executable tests are not implemented.

## Layout

```text
src/index.ts                      Public exports
src/client.ts                     Initialization, track, flush and cleanup
src/events.ts                     JSON properties and wire event types
src/session.ts                    Shared session identity, tab identity and expiry
src/delivery/queue.ts              Batching, bounded queues and retry scheduling
src/delivery/transport.ts          HTTP and page-exit delivery
tests/client.test.ts               Public behaviour and lifecycle tests
tests/session.test.ts              Storage, expiry and session tests
tests/delivery/queue.test.ts
tests/delivery/transport.test.ts
```

Tests live in `tests/`, mirroring `src/`.

`client` coordinates session and delivery modules. Keep those modules independent of frameworks and travel data. Add React/Vue adapters only when an actual integration needs one.

## Behaviour to implement

- Safe server-side import; start browser resources only during explicit initialization.
- Stable event IDs and capture timestamps across retries.
- Shared sessions across tabs, distinct tab IDs and expiry rules.
- Timer-based batches, bounded memory/retries and best-effort page-exit delivery.
- Cleanup of timers and listeners. Delivery errors must leave the host website usable.

## Setup and verification

Use pnpm. Run `pnpm install` to install the pinned formatter. Next: choose Node/browser targets, configure TypeScript and a build, then implement the empty files.

Format with `pnpm format`; check with `pnpm format:check`. Prettier formats TypeScript, JSON and Markdown with two-space indentation, double quotes, semicolons, trailing commas and a 100-column wrapping target. EditorConfig sets UTF-8, LF and final newlines. Generated output and the pnpm lockfile are excluded.

Expose `pnpm test`, `pnpm typecheck` and `pnpm build` when tooling exists. These are planned commands, not currently runnable scripts.

Prefer Node's built-in test runner if it supports the chosen setup. Use controlled clocks and transport responses for unit tests; use a real browser for cross-tab identity, navigation/refresh, storage failures and page-exit behaviour. Check representative batches against the real local backend. Empty test files are not test coverage.

Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md). The backend owns the submission contract at `alongside-backend/docs/events.md`; a sibling checkout is needed only for integration checks, not SDK unit tests.
