export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Properties = { [key: string]: Json };

export type Event = {
  id: string;
  name: string;
  timestamp: string;
  session_id: string;
  tab_id: string;
  pathname: string;
  properties: Properties;
};

export const MAX_BYTES = 64 * 1024;
export const MAX_BATCH = 100;
export const MAX_PENDING = 1000;

export function encode(events: Event[]): string {
  return JSON.stringify({ events });
}

export function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}
