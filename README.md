# Alongside JavaScript SDK

Framework-independent browser events for the local Alongside prototype. No runtime dependencies, travel types, UI or automatic content capture. Server-side imports are safe; initialize in a browser lifecycle.

## Setup

Use Node 24+ and pnpm:

```sh
pnpm install
pnpm build
```

```ts
import { createAlongside } from "alongside-js";

const alongside = createAlongside({ endpoint: "http://localhost:8080/events" });
alongside.page(); // On initial load and after pathname changes.
alongside.track("listing_viewed", { listing_id: "stay-123" });
await alongside.flush();
// On integration teardown:
await alongside.destroy();
```

`track` captures a JSON copy and returns immediately. Invalid, unserializable or oversized events are dropped without interrupting the website. `flush()` attempts currently deliverable events; failures retain their retry schedule. `destroy()` stops collection, attempts beacon delivery, aborts outstanding HTTP work and removes timers/listeners.

## Selected prototype defaults

These defaults were selected for this implementation and can be changed on request. Only the endpoint is currently configurable through the public API.

- Modern browsers. Web Locks serialize shared session creation/expiry; without them, simultaneous first creation can race.
- Same-origin tabs share a localStorage session: 30 minutes without captured events or 24 hours maximum. Opted-in visible-page updates count as activity. SessionStorage distinguishes tabs and retains their identity on ordinary reload/navigation; duplicated tabs discard copied identity. Denied storage falls back to document memory.
- Three-second batches, at most 100 events and 64 KiB UTF-8 per request. At most 1,000 pending/in-flight events, including captures awaiting identity; drop newest on overflow.
- Retry network failures, 408, 429 and 5xx: at most three network retries and ten retries total per batch. Backoff starts at three seconds, doubles to a 30-minute base cap, and uses 50–150% jitter. Ten-second request timeout. Offline pauses delivery; online resumes it.
- In-memory pending events/retries. Hidden/page-exit lifecycle attempts `sendBeacon`. Delivery is best effort: termination can lose events and in-flight requests may be duplicated. No durable queue; the backend deduplicates retained event IDs.
- Automatic fields: event UUID, ISO UTC capture timestamp, session UUID, tab UUID and pathname. No query, fragment, referrer, fingerprint, form text or project key. Fetch omits credentials. Retries preserve the exact encoded batch.

`page()` opts into generic visits: call it initially and after pathname navigation. Calls on the same pathname do nothing; query/hash changes are ignored. A new document or bfcache restoration starts a new visit. `page_viewed` begins the visit; `page_updated` reports cumulative monotonic visible time every ten seconds while visible, at visibility changes, and on departure. Both include `visit_id`, `started_at`, `visible_ms` and `state` (`visible`, `hidden`, `left`). Departures retain the old pathname. Hidden time is excluded; attention is not inferred. There is no automatic History API patching or page-content capture.

The backend owns the wire contract in `alongside-backend/docs/events.md`, including these reserved page events. Other event names/properties belong to the website. Model calls are outside this stage.

## Layout and verification

`src/index.ts` exports the client and wire types; `client.ts` owns lifecycle, `pages.ts` visible-page sampling, `events.ts` wire types/limits, `session.ts` identity and `delivery/` batching/transport. `tests/` mirrors these modules using Node's built-in runner with controlled clocks/network responses.

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm format
pnpm format:check
```

Build output is ESM JavaScript plus declarations in `dist/`. Check package exports when packaging changes. SDK unit tests need no sibling checkout. Real-browser checks live in `test-site/tests/alongside-flow.js`. Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Popup entry

The website opts into updates with `client.popup.watch(callback)` (one subscriber;
returns an unsubscribe function), reports explicit `popup.presence({ visible,
focused, payment, typingAt })`, and sends `popup.act(action, invitationId)`.
Actions are `shown`, `dismiss`, `open`, `close`. Treat `offer` as pending: request `shown` with its ID, then render only the
acknowledged `current`. An existing `current` stays visible while a replacement
awaits display approval. `typingAt` is a local timestamp only: the request contains an
age, never a key or field value. The website decides which pages block payment.

Updates use a fixed `/interventions` path at the event endpoint's origin, once a
second after completion, with no credentials. A single request runs at a time;
clicks have an eight-request queue and a ten-second timeout. Failed polls retry
on the next poll; failed actions return false so the website can offer retry.
Polling does not capture events, renew session identity or change SDK telemetry.
Responses are limited to 16 KiB and expose only the current invitation and chat
entry flags. Session evidence and model calls remain on the backend. Destroy
aborts polling and removes the subscription. The backend owns cross-tab state;
this local prototype is not a production authorization scheme.
