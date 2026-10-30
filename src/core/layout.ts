import { absMinutes, dayNum } from './dates';
import type { CalendarItem, IsoDate } from './types';

/** An item placed on the timeline: days are day numbers, `startAbs` / `endAbs` minutes since 1970 (end is exclusive) */
export interface Span {
  firstDay: number;
  lastDay: number;
  startAbs: number;
  endAbs: number;
  allDay: boolean;
  point: boolean;
}

/** A timed event with no end lasts an hour; one with an end before its start lasts at least this long */
const DEFAULT_MINUTES = 60;
const MIN_MINUTES = 15;

/** Where the item sits in time, or null when its dates cannot be read */
export function spanOf(item: CalendarItem): Span | null {
  try {
    if (item.type === 'TASK') {
      const s = absMinutes(item.start);
      const day = Math.floor(s / 1440);
      return { firstDay: day, lastDay: day, startAbs: s, endAbs: s, allDay: false, point: true };
    }
    if (item.allDay === true) {
      const first = dayNum(item.start.slice(0, 10));
      const last = Math.max(first, item.end ? dayNum(item.end.slice(0, 10)) : first);
      return { firstDay: first, lastDay: last, startAbs: first * 1440, endAbs: (last + 1) * 1440, allDay: true, point: false };
    }
    const s = absMinutes(item.start);
    const e = Math.max(item.end ? absMinutes(item.end) : s + DEFAULT_MINUTES, s + MIN_MINUTES);
    return { firstDay: Math.floor(s / 1440), lastDay: Math.floor((e - 1) / 1440), startAbs: s, endAbs: e, allDay: false, point: false };
  } catch {
    return null;
  }
}

/** All-day and multi-day items are drawn as bars across days; the rest sit on the time grid */
export const isBanner = (sp: Span): boolean => sp.allDay || sp.lastDay > sp.firstDay;

export interface WeekSegment {
  item: CalendarItem;
  /** 0-based column of the first day shown */
  col: number;
  /** Columns covered */
  span: number;
  /** 0-based row below the day numbers */
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * Lays items out across one row of `ncols` days starting at `weekStart`: each item becomes one segment, and
 * segments that would overlap are pushed into different lanes. Longer items go first so they stay on top.
 */
export function packWeek(items: readonly CalendarItem[], weekStart: IsoDate, ncols = 7): WeekSegment[] {
  const ws = dayNum(weekStart);
  const we = ws + ncols - 1;
  const cand: Array<{ item: CalendarItem; sp: Span }> = [];
  for (const item of items) {
    const sp = spanOf(item);
    if (sp && sp.lastDay >= ws && sp.firstDay <= we) cand.push({ item, sp });
  }
  cand.sort((a, b) =>
    a.sp.firstDay - b.sp.firstDay
    || (b.sp.lastDay - b.sp.firstDay) - (a.sp.lastDay - a.sp.firstDay)
    || a.sp.startAbs - b.sp.startAbs
    || a.item.id.localeCompare(b.item.id));
  const laneEnd: number[] = [];
  return cand.map(({ item, sp }) => {
    const col = Math.max(sp.firstDay, ws) - ws;
    const end = Math.min(sp.lastDay, we) - ws;
    let lane = laneEnd.findIndex((e) => e < col);
    if (lane < 0) lane = laneEnd.length;
    laneEnd[lane] = end;
    return { item, col, span: end - col + 1, lane, continuesBefore: sp.firstDay < ws, continuesAfter: sp.lastDay > we };
  });
}

export interface TimedBox {
  item: CalendarItem;
  /** Minutes from midnight */
  startMin: number;
  endMin: number;
  /** Which of `cols` side-by-side columns this box takes */
  col: number;
  cols: number;
}

/**
 * Boxes for the timed, single-day items of one day. Items that overlap in time are placed side by side.
 * A task is a point in time, so it gets `minMinutes` of room.
 */
export function timedBoxes(items: readonly CalendarItem[], day: IsoDate, minMinutes = 30): TimedBox[] {
  const d = dayNum(day);
  const base = d * 1440;
  const raw: Array<{ item: CalendarItem; startMin: number; endMin: number }> = [];
  for (const item of items) {
    const sp = spanOf(item);
    if (!sp || isBanner(sp) || sp.firstDay !== d) continue;
    const startMin = sp.startAbs - base;
    raw.push({ item, startMin, endMin: Math.min(1440, Math.max(sp.endAbs - base, startMin + minMinutes)) });
  }
  raw.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.item.id.localeCompare(b.item.id));

  const out: TimedBox[] = [];
  let group: TimedBox[] = [];
  let groupEnd = -1;
  const colEnd: number[] = [];
  const flush = (): void => {
    const cols = group.reduce((n, b) => Math.max(n, b.col + 1), 1);
    for (const b of group) b.cols = cols;
    out.push(...group);
    group = [];
    colEnd.length = 0;
  };
  for (const r of raw) {
    if (group.length > 0 && r.startMin >= groupEnd) flush();
    let col = colEnd.findIndex((e) => e <= r.startMin);
    if (col < 0) col = colEnd.length;
    colEnd[col] = r.endMin;
    group.push({ item: r.item, startMin: r.startMin, endMin: r.endMin, col, cols: 1 });
    groupEnd = group.length === 1 ? r.endMin : Math.max(groupEnd, r.endMin);
  }
  if (group.length > 0) flush();
  return out;
}
