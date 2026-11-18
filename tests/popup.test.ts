import { test } from "node:test";
import assert from "node:assert/strict";
import { createPopup } from "../src/popup.ts";
import { browser, settle } from "./browser.ts";

const state = {
  current: {
    id: "invite-1",
    purpose: "compare_rooms",
    reason: "rooms",
    text: "Want a hand comparing rooms?",
    status: "shown",
  },
  chat_open: false,
  engaged: false,
  dismissals: 0,
};
test("popup polls only when watched; serializes actions, omits text and cleans up", async (t) => {
  const env = browser(t);
  env.fetch.mock.mockImplementation(async () => new Response(JSON.stringify(state)));
  const identity = { session_id: crypto.randomUUID(), tab_id: crypto.randomUUID() };
  const popup = createPopup("http://localhost:8080/events", () => identity);
  let last: any;
  popup.presence({ visible: true, focused: true, payment: false, typingAt: Date.now() });
  assert.equal(env.fetch.mock.callCount(), 0);
  const unwatch = popup.watch((value) => (last = value));
  await settle();
  await popup.act("dismiss", "invite-1");
  assert.equal(last.current.text, state.current.text);
  const req = env.fetch.mock.calls.at(-1)!.arguments;
  assert.equal(req[0], "http://localhost:8080/interventions");
  const body = JSON.parse(String(req[1]!.body));
  assert.equal(body.action, "dismiss");
  assert.equal(body.typing_age_ms, 0);
  assert.equal(req[1]!.credentials, "omit");
  assert.equal(body.typingAt, undefined);
  unwatch();
  popup.destroy();
  const n = env.fetch.mock.callCount();
  t.mock.timers.tick(20000);
  await settle();
  assert.equal(env.fetch.mock.callCount(), n);
});
test("stale sessions, oversized responses and failures never publish", async (t) => {
  const env = browser(t);
  let ids = { session_id: "first", tab_id: "tab" };
  let release: (value: Response) => void = () => {};
  env.fetch.mock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)));
  const popup = createPopup("http://localhost:8080/events", () => ids);
  let last: any;
  popup.watch((value) => (last = value));
  await settle();
  ids = { session_id: "second", tab_id: "tab" };
  release(new Response(JSON.stringify(state)));
  await settle();
  assert.equal(last, null);
  env.fetch.mock.mockImplementation(async () => new Response("x".repeat(20000)));
  assert.equal(await popup.act("shown", "invite-1"), false);
  env.fetch.mock.mockImplementation(async () => {
    throw new Error("offline");
  });
  assert.equal(await popup.act("open", "invite-1"), false);
  popup.destroy();
});

test("replacing a watched subscription aborts obsolete work and keeps one loop", async (t) => {
  const env = browser(t);
  let first = true;
  env.fetch.mock.mockImplementation(async (_url, options) => {
    if (first) {
      first = false;
      return new Promise((_resolve, reject) =>
        options.signal.addEventListener("abort", () => reject(new Error("aborted"))),
      );
    }
    return new Response(JSON.stringify(state));
  });
  const popup = createPopup("http://localhost:8080/events", () => ({
    session_id: "s",
    tab_id: "t",
  }));
  const oldValues: any[] = [];
  const values: any[] = [];
  const old = popup.watch((value) => oldValues.push(value));
  await settle();
  const stop = popup.watch((value) => values.push(value));
  old();
  await settle();
  t.mock.timers.tick(1000);
  await settle();
  assert.equal(oldValues.filter(Boolean).length, 0);
  assert.equal(values.filter(Boolean).length, 1);
  const n = env.fetch.mock.callCount();
  t.mock.timers.tick(1000);
  await settle();
  assert.equal(env.fetch.mock.callCount(), n + 1);
  stop();
  const end = env.fetch.mock.callCount();
  t.mock.timers.tick(10000);
  await settle();
  assert.equal(env.fetch.mock.callCount(), end);
  popup.destroy();
});
