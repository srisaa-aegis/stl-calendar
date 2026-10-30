import type { DateRange, IsoDate, IsoDateTime, View } from './types';

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^T(\d{2}):(\d{2})$/;
const pad = (n: number): string => String(n).padStart(2, '0');

export function isIsoDate(s: unknown): s is IsoDate {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** "2026-11-05" or "2026-11-05T14:30" */
export function isStamp(s: unknown): s is IsoDateTime {
  if (typeof s !== 'string') return false;
  if (s.length === 10) return isIsoDate(s);
  const m = TIME_RE.exec(s.slice(10));
  return s.length === 16 && isIsoDate(s.slice(0, 10)) && !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** Days since 1970-01-01 (UTC, so no time zone or daylight saving surprises) */
export function dayNum(iso: IsoDate): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY);
}

export function isoOf(day: number): IsoDate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. 1970-01-01 was a Thursday. */
export function weekdayOf(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  return isoOf(dayNum(iso) + n);
}

export function todayIso(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function nowStamp(now: Date = new Date()): IsoDateTime {
  return `${todayIso(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Minutes since 1970-01-01 00:00 (local clock, no time zone) */
export function absMinutes(s: IsoDateTime): number {
  if (!isStamp(s)) throw new Error(`Not an ISO date or date-time: ${s}`);
  const day = dayNum(s.slice(0, 10));
  if (s.length === 10) return day * 1440;
  return day * 1440 + Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
}

export function stampOf(abs: number): IsoDateTime {
  const day = Math.floor(abs / 1440);
  const min = abs - day * 1440;
  return `${isoOf(day)}T${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export const datePart = (s: IsoDateTime): IsoDate => s.slice(0, 10);
/** "14:30", or "00:00" for a bare date */
export const timePart = (s: IsoDateTime): string => (s.length > 10 ? s.slice(11, 16) : '00:00');

export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 8)}01`;
}

export function endOfMonth(iso: IsoDate): IsoDate {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return isoOf(Math.floor(Date.UTC(y, m, 0) / MS_PER_DAY));
}

/** Same day in another month; a 31st lands on the last day of a shorter month */
export function addMonths(iso: IsoDate, n: number): IsoDate {
  const total = Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const first = `${String(y).padStart(4, '0')}-${pad(m)}-01`;
  const last = Number(endOfMonth(first).slice(8, 10));
  return `${first.slice(0, 8)}${pad(Math.min(Number(iso.slice(8, 10)), last))}`;
}

/** `weekStartsOn`: 0 = Sunday, 1 = Monday ... */
export function startOfWeek(iso: IsoDate, weekStartsOn: number): IsoDate {
  const d = dayNum(iso);
  return isoOf(d - ((weekdayOf(d) - weekStartsOn + 7) % 7));
}

export function weekDays(anchor: IsoDate, weekStartsOn: number): IsoDate[] {
  const s = dayNum(startOfWeek(anchor, weekStartsOn));
  return Array.from({ length: 7 }, (_, i) => isoOf(s + i));
}

/** The weeks shown for the month of `anchor` (4 to 6 rows of 7 days, the edges spill into the neighbouring months) */
export function monthGrid(anchor: IsoDate, weekStartsOn: number): IsoDate[][] {
  const last = dayNum(endOfMonth(anchor));
  const weeks: IsoDate[][] = [];
  let s = dayNum(startOfWeek(startOfMonth(anchor), weekStartsOn));
  while (s <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => isoOf(s + i)));
    s += 7;
  }
  return weeks;
}

export function visibleRange(view: View, anchor: IsoDate, weekStartsOn: number): DateRange {
  if (view === 'day') return { start: anchor, end: anchor };
  const weeks = view === 'week' ? [weekDays(anchor, weekStartsOn)] : monthGrid(anchor, weekStartsOn);
  const first = weeks[0] as IsoDate[];
  const lastWeek = weeks[weeks.length - 1] as IsoDate[];
  return { start: first[0] as IsoDate, end: lastWeek[6] as IsoDate };
}

/** Move the anchor one page forward (`dir` 1) or back (-1) */
export function shiftAnchor(view: View, anchor: IsoDate, dir: 1 | -1): IsoDate {
  if (view === 'month') return addMonths(anchor, dir);
  return addDays(anchor, dir * (view === 'week' ? 7 : 1));
}
