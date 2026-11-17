import { test } from "node:test";
import assert from "node:assert/strict";
import { send, beacon } from "../../src/delivery/transport.ts";
import { browser } from "../browser.ts";

test("fetch omits credentials; beacon sends plain-text JSON", async (t) => {
  const env = browser(t);
  const signal = new AbortController().signal;
  assert.equal(await send("/events", "{}", signal), 200);
  const options = env.fetch.mock.calls[0].arguments[1];
  assert.equal(options.credentials, "omit");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal(beacon("/events", "{}"), true);
  assert.equal(
    env.navigator.sendBeacon.mock.calls[0].arguments[1].type,
    "text/plain;charset=utf-8",
  );
});
