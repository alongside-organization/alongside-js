import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession } from "../src/session.ts";
import { browser } from "./browser.ts";

test("sessions are shared, tabs are distinct, and reload retains tab identity", async (t) => {
  const env = browser(t);
  const first = createSession();
  const a = await first.capture(Date.now());
  const duplicate = createSession();
  const b = await duplicate.capture(Date.now());
  assert.equal(a.session_id, b.session_id);
  assert.notEqual(a.tab_id, b.tab_id);
  duplicate.destroy();
  first.destroy();
  env.tab.setItem("alongside:tab", a.tab_id);
  const reload = createSession();
  assert.deepEqual(await reload.capture(Date.now() + 1000), a);
  reload.destroy();
});

test("inactivity and maximum age expire sessions; corrupt storage recovers", async (t) => {
  const env = browser(t);
  const session = createSession();
  const now = Date.now();
  const first = await session.capture(now);
  const second = await session.capture(now + 30 * 60 * 1000);
  assert.notEqual(first.session_id, second.session_id);
  let current = second;
  for (let minutes = 40; minutes <= 24 * 60 + 30; minutes += 10) {
    current = await session.capture(now + minutes * 60 * 1000);
  }
  assert.notEqual(second.session_id, current.session_id);
  env.local.setItem("alongside:session", "broken");
  assert.ok((await session.capture(now)).session_id);
  session.destroy();
});

test("denied storage falls back to a stable in-memory session", async (t) => {
  const env = browser(t);
  for (const store of [env.local, env.tab]) {
    t.mock.method(store, "getItem", () => {
      throw new Error("denied");
    });
    t.mock.method(store, "setItem", () => {
      throw new Error("denied");
    });
  }
  const session = createSession();
  assert.deepEqual(await session.capture(Date.now()), await session.capture(Date.now() + 1000));
  session.destroy();
});

test("readable storage with denied writes keeps one in-memory session", async (t) => {
  const env = browser(t);
  t.mock.method(env.local, "setItem", () => {
    throw new Error("quota");
  });
  const session = createSession();
  assert.deepEqual(await session.capture(Date.now()), await session.capture(Date.now() + 1000));
  session.destroy();
});

test("denied active-marker writes still give copied tabs distinct IDs", async (t) => {
  const env = browser(t);
  const set = env.tab.setItem;
  t.mock.method(env.tab, "setItem", (key, value) => {
    if (key === "alongside:tab-active") throw new Error("quota");
    return set(key, value);
  });
  const first = createSession();
  const second = createSession();
  assert.notEqual(
    (await first.capture(Date.now())).tab_id,
    (await second.capture(Date.now())).tab_id,
  );
  first.destroy();
  second.destroy();
});
