import type { Properties } from "./events.ts";

type Report = (name: string, properties: Properties, pathname: string) => void;

export function createPages(report: Report) {
  let visit: { id: string; pathname: string; started: string; visible: number } | undefined;
  let since: number | undefined;
  let left = false;

  function update(state: "visible" | "hidden" | "left", name = "page_updated") {
    if (!visit) return;
    const now = performance.now();
    // Cumulative samples survive missed updates; a monotonic clock avoids wall-clock jumps.
    if (since !== undefined) visit.visible += Math.max(0, now - since);
    since = state === "visible" ? now : undefined;
    left = state === "left";
    report(
      name,
      {
        visit_id: visit.id,
        started_at: visit.started,
        visible_ms: Math.floor(visit.visible),
        state,
      },
      visit.pathname,
    );
  }

  function page() {
    const pathname = window.location.pathname;
    if (visit?.pathname === pathname && !left) return;
    if (visit && !left) update("left");
    visit = { id: crypto.randomUUID(), pathname, started: new Date().toISOString(), visible: 0 };
    since = undefined;
    update(document.visibilityState === "visible" ? "visible" : "hidden", "page_viewed");
  }

  function visibility() {
    if (!left) update(document.visibilityState === "visible" ? "visible" : "hidden");
  }
  function hide() {
    if (!left) update("left");
  }
  function show() {
    if (left) page();
  }
  const timer = setInterval(() => {
    if (!left && document.visibilityState === "visible") update("visible");
  }, 10_000);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", show);

  return {
    page,
    destroy() {
      hide();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    },
  };
}
