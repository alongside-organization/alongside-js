export async function send(endpoint: string, body: string, signal: AbortSignal): Promise<number> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "omit",
      signal,
    });
    return response.status;
  } catch {
    return 0;
  }
}

export function beacon(endpoint: string, body: string): boolean {
  try {
    // text/plain keeps cross-origin page-exit delivery free of a JSON preflight.
    return navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain;charset=UTF-8" }));
  } catch {
    return false;
  }
}
