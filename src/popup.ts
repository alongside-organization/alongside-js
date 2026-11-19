export type Invitation = {
  id: string;
  purpose: string;
  reason: string;
  text: string;
  status: "offered" | "shown" | "dismissed" | "opened";
};
export type ChatMessage = {
  role: "visitor" | "assistant";
  text: string;
  at: string;
  /** An apology standing in for a reply that could not be written. */
  failed?: boolean;
};
export type Popup = {
  offer?: Invitation | null;
  current: Invitation | null;
  chat_open: boolean;
  engaged: boolean;
  dismissals: number;
  /** The shared conversation, once chat has started. */
  messages?: ChatMessage[];
  /** True while the backend writes a reply. */
  chat_pending?: boolean;
};
export type Presence = { visible: boolean; focused: boolean; payment: boolean; typingAt?: number };
export type PopupAction = "shown" | "dismiss" | "open" | "close";
type Identity = { session_id: string; tab_id: string };

export function createPopup(endpoint: string, identity: () => Identity | undefined) {
  const url = new URL("/interventions", endpoint).href;
  let stopped = false;
  let listener: ((popup: Popup | null) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let signals: Presence = { visible: false, focused: false, payment: false };
  let pending = 0;
  let serial: Promise<unknown> = Promise.resolve();
  let lastSession: string | undefined;
  let subscription = 0;
  function notify(value: Popup | null) {
    try {
      listener?.(value);
    } catch {
      /* Host callbacks cannot strand the request queue. */
    }
  }

  async function send(
    action?: PopupAction,
    invitation_id?: string,
    version = subscription,
  ): Promise<boolean> {
    const ids = identity();
    if (stopped || version !== subscription || !ids || navigator.onLine === false) return false;
    if (ids.session_id !== lastSession) {
      lastSession = ids.session_id;
      notify(null);
    }
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 10_000);
    try {
      const age = signals.typingAt === undefined ? undefined : Date.now() - signals.typingAt;
      const response = await fetch(url, {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...ids,
          visible: signals.visible,
          focused: signals.focused,
          payment: signals.payment,
          ...(age !== undefined && age >= 0 && age <= 5000 ? { typing_age_ms: age } : {}),
          ...(action ? { action, invitation_id } : {}),
        }),
      });
      if (response.status !== 200) return false;
      const reader = response.body?.getReader();
      if (!reader) return false;
      let size = 0;
      let text = "";
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 262_144) {
          await reader.cancel();
          return false;
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      const value = JSON.parse(text) as Popup;
      if (!validPopup(value)) return false;
      if (stopped || version !== subscription || identity()?.session_id !== ids.session_id)
        return false;
      notify(value);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      controller = undefined;
    }
  }
  function request(action?: PopupAction, id?: string): Promise<boolean> {
    // Polls coalesce; a small bounded queue preserves deliberate clicks during a slow poll.
    if (stopped || pending >= 8 || (!action && pending > 0)) return Promise.resolve(false);
    pending++;
    const version = subscription;
    const next = serial.then(() => send(action, id, version)).finally(() => pending--);
    serial = next;
    return next;
  }
  async function poll(version: number) {
    if (stopped || version !== subscription || !listener) return;
    await request();
    if (!stopped && version === subscription) timer = setTimeout(() => void poll(version), 1000);
  }
  return {
    watch(callback: (popup: Popup | null) => void) {
      const version = ++subscription;
      controller?.abort();
      listener = callback;
      clearTimeout(timer);
      void poll(version);
      return () => {
        if (version !== subscription) return;
        subscription++;
        controller?.abort();
        listener = undefined;
        clearTimeout(timer);
      };
    },
    presence(value: Presence) {
      signals = { ...value };
      if (listener) void request();
    },
    act: (action: PopupAction, id: string) => request(action, id),
    // Sends one visitor message; the reply arrives through watch() as messages and chat_pending.
    async say(text: string): Promise<boolean> {
      const ids = identity();
      const value = text.trim();
      if (stopped || !ids || !value || [...value].length > 500 || navigator.onLine === false)
        return false;
      try {
        const response = await fetch(new URL("/chat", endpoint).href, {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({ ...ids, text: value }),
        });
        if (response.status !== 202) return false;
      } catch {
        return false;
      }
      if (listener) void request();
      return true;
    },
    destroy() {
      stopped = true;
      subscription++;
      listener = undefined;
      clearTimeout(timer);
      controller?.abort();
    },
  };
}

function validPopup(value: Popup): boolean {
  if (
    !value ||
    typeof value.chat_open !== "boolean" ||
    typeof value.engaged !== "boolean" ||
    !Number.isInteger(value.dismissals) ||
    value.dismissals < 0 ||
    value.dismissals > 2
  )
    return false;
  const c = value.current;
  if (value.offer !== undefined && !validInvitation(value.offer)) return false;
  if (value.chat_pending !== undefined && typeof value.chat_pending !== "boolean") return false;
  if (
    value.messages !== undefined &&
    !(
      Array.isArray(value.messages) &&
      value.messages.length <= 64 &&
      value.messages.every(
        (m) =>
          m &&
          (m.role === "visitor" || m.role === "assistant") &&
          typeof m.text === "string" &&
          m.text.length <= 2000 &&
          typeof m.at === "string" &&
          (m.failed === undefined || typeof m.failed === "boolean"),
      )
    )
  )
    return false;
  return validInvitation(c);
}

function validInvitation(c: Invitation | null): boolean {
  return (
    c === null ||
    (typeof c === "object" &&
      typeof c.id === "string" &&
      c.id.length <= 64 &&
      typeof c.text === "string" &&
      c.text.length <= 360 &&
      typeof c.purpose === "string" &&
      typeof c.reason === "string" &&
      ["offered", "shown", "dismissed", "opened"].includes(c.status))
  );
}
