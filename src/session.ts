const SESSION_KEY = "alongside:session";
const TAB_KEY = "alongside:tab";
const ACTIVE_KEY = "alongside:tab-active";
const IDLE_MS = 30 * 60 * 1000;
const MAX_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Record = { id: string; started: number; active: number };

export function createSession() {
  let memory: Record | undefined;
  let memoryOnly = false;
  const fallbackTab = crypto.randomUUID();
  let tab: string = fallbackTab;
  // A live-tab marker is copied into new tabs but removed before a same-tab reload.
  try {
    const previous = sessionStorage.getItem(TAB_KEY);
    if (previous && UUID.test(previous) && !sessionStorage.getItem(ACTIVE_KEY)) tab = previous;
    sessionStorage.setItem(TAB_KEY, tab);
  } catch {
    tab = fallbackTab;
  }
  function markActive() {
    try {
      sessionStorage.setItem(ACTIVE_KEY, "1");
    } catch {
      tab = fallbackTab;
    }
  }
  function release() {
    try {
      sessionStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }
  markActive();
  window.addEventListener("beforeunload", release);
  window.addEventListener("pageshow", markActive);

  function capture(now: number) {
    let record = memory;
    // After storage fails, keep one document identity instead of rotating it on every event.
    if (!memoryOnly) {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        let value;
        try {
          value = JSON.parse(raw ?? "null");
        } catch {}
        record =
          value &&
          typeof value.id === "string" &&
          UUID.test(value.id) &&
          Number.isFinite(value.started) &&
          Number.isFinite(value.active) &&
          value.started <= value.active &&
          value.active <= now
            ? value
            : undefined;
      } catch {
        memoryOnly = true;
      }
    }
    if (!record || now - record.active >= IDLE_MS || now - record.started >= MAX_MS) {
      record = { id: crypto.randomUUID(), started: now, active: now };
    }
    record.active = Math.max(record.active, now);
    memory = record;
    if (!memoryOnly) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(record));
      } catch {
        memoryOnly = true;
      }
    }
    return { session_id: record.id, tab_id: tab };
  }

  return {
    async capture(now: number) {
      // Web Locks serialize first creation and expiry across same-origin tabs.
      if (navigator.locks) {
        return navigator.locks
          .request(SESSION_KEY, () => capture(Math.max(now, Date.now())))
          .catch(() => capture(now));
      }
      // shortcut: older browsers can race on first creation; require Web Locks for atomic sharing.
      return capture(now);
    },
    destroy() {
      window.removeEventListener("beforeunload", release);
      window.removeEventListener("pageshow", markActive);
      release();
    },
  };
}
