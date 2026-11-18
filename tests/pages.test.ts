import { test } from "node:test";
import assert from "node:assert/strict";
import { createAlongside } from "../src/index.ts";
import { browser, settle } from "./browser.ts";

test("page visits ignore query changes, pause while hidden and retain the departing path", async (t) => {
  const env = browser(t);
  t.mock.method(performance, "now", () => Date.now());
  const client = createAlongside({ endpoint: "/events" });
  client.page();
  t.mock.timers.tick(4000);
  env.window.location.href += "&filter=changed";
  client.page();
  env.document.visibilityState = "hidden";
  env.document.dispatchEvent(new Event("visibilitychange"));
  await settle();
  t.mock.timers.tick(30_000);
  env.document.visibilityState = "visible";
  env.document.dispatchEvent(new Event("visibilitychange"));
  t.mock.timers.tick(2000);
  env.window.location.pathname = "/next";
  client.page();
  await client.flush();
  const bodies = await Promise.all([
    ...env.fetch.mock.calls.map((call: any) => JSON.parse(call.arguments[1].body)),
    ...(await Promise.all(
      env.navigator.sendBeacon.mock.calls.map(async (call: any) =>
        JSON.parse(await call.arguments[1].text()),
      ),
    )),
  ]);
  const events = [
    ...new Map(bodies.flatMap((b: any) => b.events).map((e: any) => [e.id, e])).values(),
  ] as any[];
  assert.equal(events.filter((e) => e.name === "page_viewed").length, 2);
  const ended = events.find((e) => e.properties.state === "left");
  assert.equal(ended.pathname, "/");
  assert.equal(ended.properties.visible_ms, 6000);
  assert.ok(events.some((e) => e.name === "page_viewed" && e.pathname === "/next"));
  await client.destroy();
});

test("visible heartbeats stop on exit; bfcache restores a fresh visit; destroy removes collection", async (t) => {
  const env = browser(t);
  t.mock.method(performance, "now", () => Date.now());
  const client = createAlongside({ endpoint: "/events" });
  client.page();
  await settle();
  t.mock.timers.tick(10_000);
  await client.flush();
  assert.ok(
    env.fetch.mock.calls.some((c: any) =>
      JSON.parse(c.arguments[1].body).events.some((e: any) => e.properties.visible_ms === 10_000),
    ),
  );
  env.window.dispatchEvent(new Event("pagehide"));
  await settle();
  const calls = env.navigator.sendBeacon.mock.callCount();
  t.mock.timers.tick(30_000);
  await settle();
  assert.equal(env.navigator.sendBeacon.mock.callCount(), calls);
  env.window.dispatchEvent(new Event("pageshow"));
  await client.flush();
  const views = env.fetch.mock.calls
    .flatMap((c: any) => JSON.parse(c.arguments[1].body).events)
    .filter((e: any) => e.name === "page_viewed");
  assert.equal(views.length, 2);
  assert.notEqual(views[0].properties.visit_id, views[1].properties.visit_id);
  await client.destroy();
  t.mock.timers.tick(30_000);
  env.window.dispatchEvent(new Event("pageshow"));
  assert.equal(env.navigator.sendBeacon.mock.callCount(), calls + 1);
});
