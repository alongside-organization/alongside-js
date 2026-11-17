import { bytes, encode, MAX_BATCH, MAX_BYTES, MAX_PENDING, type Event } from "../events.ts";
import { beacon, send } from "./transport.ts";

type Batch = {
  events: Event[];
  body: string;
  networkRetries: number;
  retries: number;
  due: number;
};

export function createQueue(endpoint: string) {
  const pending: Event[] = [];
  const retries: Batch[] = [];
  let count = 0;
  let stopped = false;
  let running: Promise<void> | undefined;
  let active: Batch | undefined;
  let controller: AbortController | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function take(): Batch {
    const events: Event[] = [];
    while (pending.length && events.length < MAX_BATCH) {
      if (bytes(encode([...events, pending[0]])) > MAX_BYTES) break;
      events.push(pending.shift()!);
    }
    return { events, body: encode(events), networkRetries: 0, retries: 0, due: 0 };
  }

  async function drain() {
    clearTimeout(retryTimer);
    while (!stopped && navigator.onLine !== false) {
      // A batch waiting for retry must not hold up fresh events.
      const index = retries.findIndex((batch) => batch.due <= Date.now());
      active = index >= 0 ? retries.splice(index, 1)[0] : pending.length ? take() : undefined;
      if (!active) break;
      const batch = active;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      const status = await send(endpoint, batch.body, controller.signal);
      clearTimeout(timeout);
      active = undefined;
      if (stopped) break;
      const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
      if (retryable && batch.retries < 10 && (status !== 0 || batch.networkRetries < 3)) {
        // Retain the original encoded body so retry IDs and capture times stay unchanged.
        const delay = Math.min(3000 * 2 ** batch.retries, 30 * 60 * 1000);
        batch.due = Date.now() + Math.ceil(delay * (0.5 + Math.random()));
        batch.retries++;
        if (status === 0) batch.networkRetries++;
        retries.push(batch);
      } else {
        count -= batch.events.length;
      }
    }
    if (!stopped && retries.length && navigator.onLine !== false) {
      retryTimer = setTimeout(
        flush,
        Math.max(0, Math.min(...retries.map((b) => b.due)) - Date.now()),
      );
    }
  }

  function flush(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (!running) running = drain().finally(() => (running = undefined));
    return running;
  }

  function online() {
    for (const batch of retries) batch.due = Date.now();
    void flush();
  }
  // Batch limits split requests; only this timer starts normal delivery.
  const interval = setInterval(flush, 3000);
  window.addEventListener("online", online);

  return {
    size: () => count,
    add(event: Event) {
      if (stopped || count >= MAX_PENDING || bytes(encode([event])) > MAX_BYTES) return false;
      pending.push(event);
      count++;
      return true;
    },
    flush,
    beacon() {
      const unsent: Batch[] = [...retries];
      retries.length = 0;
      while (pending.length) unsent.push(take());
      for (const batch of unsent) {
        // Beacon acceptance means queued by the browser, not acknowledged by the server.
        if (beacon(endpoint, batch.body)) count -= batch.events.length;
        else retries.push(batch);
      }
      // An in-flight request may have reached the server; resending can duplicate it.
      if (active) beacon(endpoint, active.body);
    },
    destroy() {
      stopped = true;
      clearInterval(interval);
      clearTimeout(retryTimer);
      controller?.abort();
      window.removeEventListener("online", online);
      pending.length = retries.length = count = 0;
    },
  };
}
