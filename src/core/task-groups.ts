import { dayNum, startOfWeek } from './dates';
import { spanOf } from './layout';
import type { CalendarItem, DateRange, IsoDate } from './types';

export type TaskGroupKey = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'planned' | 'earlier';

export interface TaskGroup { key: TaskGroupKey; label: string; items: CalendarItem[] }

export interface GroupOptions {
  today: IsoDate;
  weekStartsOn: number;
  /** Only tasks due inside this range are grouped (overdue tasks are always listed) */
  range?: DateRange;
}

const LABELS: Record<TaskGroupKey, string> = {
  overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', thisWeek: 'This week', nextWeek: 'Next week', planned: 'Planned', earlier: 'Earlier',
};
const ORDER: readonly TaskGroupKey[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'planned', 'earlier'];

/** A task that is still open and was due on an earlier day */
export function isOverdue(item: CalendarItem, today: IsoDate): boolean {
  if (item.type !== 'TASK' || item.status === 'CLOSED') return false;
  const sp = spanOf(item);
  return !!sp && sp.firstDay < dayNum(today);
}

/**
 * Sorts tasks into Overdue / Today / Tomorrow / This week / Next week / Planned. Closed tasks from earlier days
 * that fall in the range go to Earlier. Empty groups are left out.
 */
export function groupTasks(items: readonly CalendarItem[], opts: GroupOptions): TaskGroup[] {
  const today = dayNum(opts.today);
  const thisWeekEnd = dayNum(startOfWeek(opts.today, opts.weekStartsOn)) + 7;
  const nextWeekEnd = thisWeekEnd + 7;
  const lo = opts.range ? dayNum(opts.range.start) : -Infinity;
  const hi = opts.range ? dayNum(opts.range.end) : Infinity;

  const buckets = new Map<TaskGroupKey, Array<{ item: CalendarItem; at: number }>>();
  for (const item of items) {
    if (item.type !== 'TASK') continue;
    const sp = spanOf(item);
    if (!sp) continue;
    const d = sp.firstDay;
    let key: TaskGroupKey;
    if (isOverdue(item, opts.today)) key = 'overdue';
    else if (d < lo || d > hi) continue;
    else if (d < today) key = 'earlier';
    else if (d === today) key = 'today';
    else if (d === today + 1) key = 'tomorrow';
    else if (d < thisWeekEnd) key = 'thisWeek';
    else if (d < nextWeekEnd) key = 'nextWeek';
    else key = 'planned';
    const list = buckets.get(key) ?? [];
    list.push({ item, at: sp.startAbs });
    buckets.set(key, list);
  }
  return ORDER.flatMap((key) => {
    const list = buckets.get(key);
    if (!list || list.length === 0) return [];
    list.sort((a, b) => a.at - b.at || a.item.id.localeCompare(b.item.id));
    return [{ key, label: LABELS[key], items: list.map((x) => x.item) }];
  });
}
