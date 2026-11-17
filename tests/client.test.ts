import { test } from "node:test";
import assert from "node:assert/strict";
import { createAlongside } from "../src/index.ts";
import { browser, settle } from "./browser.ts";

test("import is safe outside browsers; initialization is explicit", () => {
  assert.equal(typeof createAlongside, "function");
  assert.throws(() => createAlongside({ endpoint: "http://localhost:8080/events" }), /browser/);
});

test("capture clones facts, batches after three seconds and adds only agreed metadata", async (t) => {
  const env = browser(t);
  const client = createAlongside({ endpoint: "http://localhost:8080/events" });
  const properties = { listing_id: "stay-1", nested: { value: 1 } };
  client.track("listing_viewed", properties);
  properties.nested.value = 2;
  await settle();
  t.mock.timers.tick(2999);
  assert.equal(env.fetch.mock.callCount(), 0);
  t.mock.timers.tick(1);
  await settle();
  const body = JSON.parse(env.fetch.mock.calls[0].arguments[1].body);
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].properties.nested.value, 1);
  assert.deepEqual(Object.keys(body.events[0]).sort(), [
    "id",
    "name",
    "pathname",
    "properties",
    "session_id",
    "tab_id",
    "timestamp",
  ]);
  assert.equal(body.events[0].pathname, "/");
  await client.destroy();
});

test("bad properties do not break the host; destroy removes lifecycle delivery", async (t) => {
  const env = browser(t);
  const client = createAlongside({ endpoint: "/events" });
  const circular: any = {};
  circular.self = circular;
  assert.doesNotThrow(() => client.track("bad", circular));
  client.track("", {});
  client.track("oversized", { text: "x".repeat(65536) });
  await client.flush();
  assert.equal(env.fetch.mock.callCount(), 0);
  client.track("good");
  await client.destroy();
  const calls = env.navigator.sendBeacon.mock.callCount();
  client.track("after_destroy");
  env.window.dispatchEvent(new Event("pagehide"));
  env.document.visibilityState = "hidden";
  env.document.dispatchEvent(new Event("visibilitychange"));
  t.mock.timers.tick(6000);
  await settle();
  assert.equal(env.navigator.sendBeacon.mock.callCount(), calls);
  assert.equal(env.fetch.mock.callCount(), 0);
});

test("pagehide sends queued facts using beacon", async (t) => {
  const env = browser(t);
  const client = createAlongside({ endpoint: "/events" });
  client.track("exit");
  await settle();
  env.window.dispatchEvent(new Event("pagehide"));
  assert.equal(env.navigator.sendBeacon.mock.callCount(), 1);
  const blob = env.navigator.sendBeacon.mock.calls[0].arguments[1];
  assert.equal(JSON.parse(await blob.text()).events[0].name, "exit");
  await client.destroy();
});

test("oversized captures cannot occupy pending slots and exclude a valid event", async (t) => {
  const env = browser(t);
  const client = createAlongside({ endpoint: "/events" });
  for (let i = 0; i < 1000; i++) client.track("oversized", { text: "x".repeat(65536) });
  client.track("valid");
  await client.flush();
  assert.equal(env.fetch.mock.callCount(), 1);
  assert.equal(JSON.parse(env.fetch.mock.calls[0].arguments[1].body).events[0].name, "valid");
  await client.destroy();
});
