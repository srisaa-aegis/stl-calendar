export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function btn(label: string, cls: string, attrs: Record<string, string> = {}): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  return b;
}

const utc = (iso: string, opts: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

export const fmtMonthYear = (iso: string): string => utc(iso, { month: 'long', year: 'numeric' });
export const fmtDayLong = (iso: string): string => utc(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtShort = (iso: string): string => utc(iso, { day: 'numeric', month: 'short' });
export const fmtWeekday = (iso: string): string => utc(iso, { weekday: 'short' });
export const fmtDayNumber = (iso: string): string => String(Number(iso.slice(8, 10)));

/** "9:30 AM" from "2026-11-05T09:30" */
export function fmtTime(stamp: string): string {
  if (stamp.length <= 10) return '';
  const h = Number(stamp.slice(11, 13));
  const m = stamp.slice(14, 16);
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtHour(h: number): string {
  if (h === 0) return '';
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}
