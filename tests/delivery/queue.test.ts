import { test } from "node:test";
import assert from "node:assert/strict";
import { createQueue } from "../../src/delivery/queue.ts";
import { browser, event, settle } from "../browser.ts";

test("queue bounds pending events and splits batches at 100 and 64 KiB", async (t) => {
  const env = browser(t);
  const queue = createQueue("/events");
  for (let i = 0; i < 1000; i++) assert.equal(queue.add(event()), true);
  assert.equal(queue.add(event()), false);
  await queue.flush();
  assert.equal(env.fetch.mock.callCount(), 10);
  for (const call of env.fetch.mock.calls)
    assert.equal(JSON.parse(call.arguments[1].body).events.length, 100);
  for (let i = 0; i < 3; i++) queue.add({ ...event(), properties: { text: "é".repeat(16000) } });
  await queue.flush();
  for (const call of env.fetch.mock.calls)
    assert.ok(Buffer.byteLength(call.arguments[1].body) <= 65536);
  assert.equal(queue.size(), 0);
  queue.destroy();
});

test("network retries are bounded and preserve the exact captured batch", async (t) => {
  const env = browser(t);
  env.fetch.mock.mockImplementation(async () => {
    throw new TypeError("offline");
  });
  t.mock.method(Math, "random", () => 0.5);
  const queue = createQueue("/events");
  queue.add(event());
  await queue.flush();
  for (const delay of [3000, 6000, 12000]) {
    t.mock.timers.tick(delay);
    await settle();
  }
  assert.equal(env.fetch.mock.callCount(), 4);
  assert.equal(new Set(env.fetch.mock.calls.map((call: any) => call.arguments[1].body)).size, 1);
  assert.equal(queue.size(), 0);
  queue.destroy();
});

test("4xx drops, 429/5xx retry, and offline waits for online", async (t) => {
  const env = browser(t);
  const queue = createQueue("/events");
  env.navigator.onLine = false;
  queue.add(event());
  await queue.flush();
  assert.equal(env.fetch.mock.callCount(), 0);
  env.navigator.onLine = true;
  env.fetch.mock.mockImplementationOnce(async () => ({ status: 429 }));
  env.window.dispatchEvent(new Event("online"));
  await settle();
  assert.equal(queue.size(), 1);
  t.mock.timers.tick(4500);
  await settle();
  assert.equal(queue.size(), 0);
  env.fetch.mock.mockImplementationOnce(async () => ({ status: 400 }));
  queue.add(event());
  await queue.flush();
  assert.equal(queue.size(), 0);
  env.fetch.mock.mockImplementation(async () => ({ status: 503 }));
  t.mock.method(Math, "random", () => 0.5);
  queue.add(event());
  await queue.flush();
  const before = env.fetch.mock.callCount();
  for (let attempt = 0; attempt < 10; attempt++) {
    t.mock.timers.tick(Math.min(3000 * 2 ** attempt, 1800000));
    await settle();
  }
  assert.equal(env.fetch.mock.callCount() - before, 10);
  assert.equal(queue.size(), 0);
  queue.destroy();
});

test("beacon failure retains pending events; destroy aborts a stalled request", async (t) => {
  const env = browser(t);
  const queue = createQueue("/events");
  queue.add(event());
  env.navigator.sendBeacon.mock.mockImplementation(() => false);
  queue.beacon();
  assert.equal(queue.size(), 1);
  let signal: AbortSignal;
  env.fetch.mock.mockImplementation((_url: string, options: any) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("aborted"))),
    );
  });
  const flushing = queue.flush();
  queue.destroy();
  await flushing;
  assert.equal(signal!.aborted, true);
  t.mock.timers.tick(20000);
  await settle();
  assert.equal(env.fetch.mock.callCount(), 1);
});
