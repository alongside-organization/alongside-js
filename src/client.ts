import { createQueue } from "./delivery/queue.ts";
import { createSession } from "./session.ts";
import { bytes, encode, MAX_BYTES, MAX_PENDING, type Event, type Properties } from "./events.ts";

export type Options = { endpoint: string };

export function createAlongside({ endpoint }: Options) {
  if (typeof window === "undefined") throw new Error("Initialize Alongside in the browser.");
  const url = new URL(endpoint, window.location.href);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Alongside needs an HTTP(S) endpoint.");
  const session = createSession();
  const queue = createQueue(url.href);
  // Identity lookup is asynchronous, so flush and capacity must include captures waiting on it.
  const captures = new Set<Promise<void>>();
  let closing = false;
  function exit() {
    queue.beacon();
  }
  function hidden() {
    if (document.visibilityState === "hidden") exit();
  }
  window.addEventListener("pagehide", exit);
  document.addEventListener("visibilitychange", hidden);

  return {
    track(name: string, properties: Properties = {}): void {
      if (closing || queue.size() + captures.size >= MAX_PENDING) return;
      try {
        if (typeof name !== "string" || !name.trim() || bytes(name) > 100) return;
        if (!properties || typeof properties !== "object" || Array.isArray(properties)) return;
        const now = Date.now();
        if (bytes(window.location.pathname) > 2048) return;
        const copy = JSON.parse(JSON.stringify(properties)) as Properties;
        if (!copy || typeof copy !== "object" || Array.isArray(copy)) return;
        const event = {
          id: crypto.randomUUID(),
          name,
          timestamp: new Date(now).toISOString(),
          pathname: window.location.pathname,
          properties: copy,
        };
        // UUID placeholders let us reject oversized events before reserving a capture slot.
        if (bytes(encode([{ ...event, session_id: event.id, tab_id: event.id }])) > MAX_BYTES)
          return;
        const capture = session
          .capture(now)
          .then((identity) => {
            queue.add({ ...event, ...identity } satisfies Event);
          })
          .catch(() => {})
          .finally(() => captures.delete(capture));
        captures.add(capture);
      } catch {
        // Invalid or unserializable telemetry must not interrupt the host website.
      }
    },
    async flush(): Promise<void> {
      await Promise.all(captures);
      await queue.flush();
    },
    async destroy(): Promise<void> {
      if (closing) return;
      closing = true;
      window.removeEventListener("pagehide", exit);
      document.removeEventListener("visibilitychange", hidden);
      session.destroy();
      await Promise.all(captures);
      queue.beacon();
      queue.destroy();
    },
  };
}
