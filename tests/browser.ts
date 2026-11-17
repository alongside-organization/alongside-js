import { mock } from "node:test";

export function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

export function browser(t: any) {
  const window = Object.assign(new EventTarget(), {
    location: { href: "http://localhost:3000/?private=value", pathname: "/" },
  });
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const navigator = { onLine: true, sendBeacon: mock.fn(() => true) };
  const local = storage();
  const tab = storage();
  for (const [name, value] of Object.entries({
    window,
    document,
    navigator,
    localStorage: local,
    sessionStorage: tab,
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete (globalThis as any)[name];
    });
  }
  const fetch = t.mock.method(globalThis, "fetch", async () => ({ status: 200 }));
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 1_800_000_000_000 });
  return { window, document, navigator, local, tab, fetch };
}

export async function settle() {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}

export function event() {
  return {
    id: crypto.randomUUID(),
    name: "example",
    timestamp: new Date().toISOString(),
    session_id: crypto.randomUUID(),
    tab_id: crypto.randomUUID(),
    pathname: "/",
    properties: {},
  };
}
