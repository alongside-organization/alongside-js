# Alongside JavaScript SDK

[![npm](https://img.shields.io/npm/v/@runalongside/js)](https://www.npmjs.com/package/@runalongside/js)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The browser SDK for [Alongside](https://runalongside.com), an AI sales agent that understands what a visitor is looking for and offers help at the right moment. The SDK sends visitor events to the Alongside backend and lets your site show Alongside's chat invitations and conversations in its own UI.

- No runtime dependencies, framework-independent, ESM with TypeScript types.
- Safe to import during server rendering; it only touches browser APIs once you create a client.
- Collects only what you send, plus anonymous session and page context. No form text, query strings, referrers or fingerprinting.

## Installation

```sh
npm install @runalongside/js
# or
pnpm add @runalongside/js
# or
yarn add @runalongside/js
```

## Quick start

```ts
import { createAlongside } from "@runalongside/js";

const alongside = createAlongside({ endpoint: "https://api.runalongside.com/events" });

alongside.page(); // on load and after each client-side route change
alongside.track("listing_viewed", { listing_id: "stay-123" });
```

Create one client per page load, in the browser (for example in a React `useEffect` or your framework's client entry point).

## Usage

### Track events

```ts
alongside.track("search_submitted", { destination: "Mallorca", nights: 7 });
```

`track` copies the properties (any JSON value) and returns immediately. Events are batched and sent in the background. Invalid, unserialisable or oversized events are dropped without affecting your site. Event names and properties are yours to choose; agree them with your Alongside contact.

### Page visits

```ts
alongside.page();
```

Call `page()` on first load and after every pathname change. It sends `page_viewed`, then `page_updated` with the visible time every 10 seconds while the tab is visible, on visibility changes and on departure. Calls for the same pathname, and query or hash changes, are ignored. The SDK does not patch the History API, so single-page apps call `page()` from their router.

### Chat invitations and conversation

Alongside decides when to invite a visitor to chat; your site renders the invitation and chat panel.

```ts
const stop = alongside.popup.watch((popup) => {
  if (popup?.offer) alongside.popup.act("shown", popup.offer.id); // acknowledge before showing
  render(popup?.current, popup?.messages, popup?.chat_pending); // your UI
});

// Keep presence current so invitations appear only when the visitor can see them.
alongside.popup.presence({
  visible: !document.hidden,
  focused: document.hasFocus(),
  payment: false,
});

// Visitor actions
await alongside.popup.act("open", invitation.id); // also "dismiss" and "close"
await alongside.popup.say("Is there anything cheaper?"); // true when accepted
```

- Treat `offer` as pending: send `shown` with its ID, then render only the acknowledged `current`.
- Replies arrive through `watch` in `messages`; `chat_pending` is true while Alongside writes one. Render message text as plain text.
- Set `payment: true` on checkout or payment pages; Alongside will not interrupt them. `typingAt` (a timestamp of the last keystroke) stays local; only its age is sent, never keys or values.

### Flush and clean up

```ts
await alongside.flush(); // send everything currently deliverable
await alongside.destroy(); // stop collecting, send what remains, remove timers and listeners
```

## API

| Member                                                     | Description                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `createAlongside({ endpoint })`                            | Creates a client. `endpoint` is your Alongside events URL.                                 |
| `track(name, properties?)`                                 | Queues an event.                                                                           |
| `page()`                                                   | Starts a page visit for the current pathname.                                              |
| `flush()`                                                  | Resolves after attempting delivery of queued events.                                       |
| `destroy()`                                                | Stops collection and cleans up.                                                            |
| `popup.watch(callback)`                                    | Subscribes to invitation and chat state (one subscriber). Returns an unsubscribe function. |
| `popup.presence({ visible, focused, payment, typingAt? })` | Reports whether the visitor can see the page.                                              |
| `popup.act(action, invitationId)`                          | Sends `shown`, `dismiss`, `open` or `close`. Resolves `false` on failure.                  |
| `popup.say(text)`                                          | Sends a chat message (1–500 characters) while chat is open.                                |

Exported types: `Options`, `Event`, `Properties`, `Json`, `Popup`, `Invitation`, `ChatMessage`, `Presence`, `PopupAction`.

## Data and delivery

- **Collected automatically:** event ID, capture time (UTC), anonymous session ID, tab ID and pathname. No cookies; requests omit credentials.
- **Sessions:** shared by same-origin tabs through `localStorage`; they end after 30 minutes without events or 24 hours in total. If storage is blocked, the SDK keeps identity in memory.
- **Batching:** every 3 seconds, at most 100 events or 64 KiB per request, at most 1,000 queued (newest dropped beyond that).
- **Retries:** network errors, 408, 429 and 5xx retry with jittered exponential backoff (from 3 seconds, capped at 30 minutes; at most 10 retries per batch). Delivery pauses while offline. On page hide or exit, the SDK uses `sendBeacon`.
- **Best effort:** the queue is in memory, so closing the tab can lose events, and retries can duplicate them; the backend deduplicates by event ID.
- **Chat polling:** while watched, the SDK polls `/interventions` on the endpoint's origin once a second after each response. Polling never creates events or extends the session.

The wire format is defined by the Alongside backend (`alongside-backend/docs/events.md`).

## Browser support

Modern evergreen browsers. Web Locks keep session creation consistent across tabs; without them, two tabs opened at the same moment may briefly start separate sessions.

## Development

Requires Node.js 24+ and pnpm.

```sh
pnpm install
pnpm test          # Node's test runner with controlled clocks and network
pnpm typecheck
pnpm build         # ESM and type declarations in dist/
pnpm format:check  # or `pnpm format` to fix
```

| Path             | Owns                            |
| ---------------- | ------------------------------- |
| `src/index.ts`   | Public exports                  |
| `src/client.ts`  | Client lifecycle                |
| `src/pages.ts`   | Page visits and visible time    |
| `src/popup.ts`   | Invitations, chat and polling   |
| `src/session.ts` | Session and tab identity        |
| `src/events.ts`  | Wire types and limits           |
| `src/delivery/`  | Batching, retries and transport |
| `tests/`         | Tests mirroring `src/`          |

Real-browser checks live in the test site (`test-site/tests/alongside-flow.js`). See [CONTRIBUTING.md](CONTRIBUTING.md) for the merge checklist and release process.

## License

[MIT](LICENSE)
