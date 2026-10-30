import {
  absMinutes, addMonths, groupTasks, isOverdue, isStamp, monthGrid, packWeek, shiftAnchor, spanOf, stampOf, startOfWeek, timedBoxes,
  visibleRange, weekDays,
} from '../src';
import type { CalendarItem } from '../src';

const ev = (id: string, start: string, end?: string, o: Partial<CalendarItem> = {}): CalendarItem =>
  ({ id, type: 'EVENT', title: id, start, ...(end ? { end } : {}), ...o });
const task = (id: string, start: string, o: Partial<CalendarItem> = {}): CalendarItem =>
  ({ id, type: 'TASK', title: id, start, status: 'OPEN', ...o });

describe('dates', () => {
  it('reads and writes date-times', () => {
    expect(isStamp('2026-11-05')).toBe(true);
    expect(isStamp('2026-11-05T14:30')).toBe(true);
    expect(isStamp('2026-11-05T25:00')).toBe(false);
    expect(isStamp('2026-02-30')).toBe(false);
    expect(stampOf(absMinutes('2026-11-05T14:30'))).toBe('2026-11-05T14:30');
    expect(() => absMinutes('nope')).toThrow();
  });

  it('adds months and clamps to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('finds the week start for Monday and Sunday weeks', () => {
    expect(startOfWeek('2026-11-05', 1)).toBe('2026-11-02'); // 5 Nov 2026 is a Thursday
    expect(startOfWeek('2026-11-05', 0)).toBe('2026-11-01');
    expect(weekDays('2026-11-05', 1)[6]).toBe('2026-11-08');
  });

  it('builds the month grid with the neighbouring days', () => {
    const g = monthGrid('2026-11-15', 1);
    expect(g).toHaveLength(6); // 1 Nov 2026 is a Sunday, so Monday-start weeks need six rows
    expect(g[0]?.[0]).toBe('2026-10-26');
    expect(g[5]?.[6]).toBe('2026-12-06');
    expect(g.every((w) => w.length === 7)).toBe(true);
  });

  it('works out the visible range and moves between pages', () => {
    expect(visibleRange('day', '2026-11-05', 1)).toEqual({ start: '2026-11-05', end: '2026-11-05' });
    expect(visibleRange('week', '2026-11-05', 1)).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(visibleRange('month', '2026-11-05', 1).start).toBe('2026-10-26');
    expect(shiftAnchor('week', '2026-11-05', 1)).toBe('2026-11-12');
    expect(shiftAnchor('month', '2026-11-05', -1)).toBe('2026-10-05');
  });
});

describe('spanOf', () => {
  it('treats a task as a point and an all-day end as inclusive', () => {
    expect(spanOf(task('t', '2026-11-05T10:00'))?.point).toBe(true);
    const sp = spanOf(ev('a', '2026-11-05', '2026-11-07', { allDay: true }));
    expect(sp && sp.lastDay - sp.firstDay).toBe(2);
  });

  it('gives a timed event with no end an hour, and ends past midnight on the next day', () => {
    const one = spanOf(ev('a', '2026-11-05T10:00'));
    expect(one && one.endAbs - one.startAbs).toBe(60);
    const over = spanOf(ev('b', '2026-11-05T22:00', '2026-11-06T02:00'));
    expect(over && over.lastDay - over.firstDay).toBe(1);
  });

  it('returns null for unreadable dates', () => {
    expect(spanOf(ev('x', 'garbage'))).toBeNull();
  });
});

describe('packWeek', () => {
  const week = '2026-11-02';
  it('puts overlapping items in separate lanes and reuses free lanes', () => {
    const items = [
      ev('long', '2026-11-02', '2026-11-04', { allDay: true }),
      ev('mid', '2026-11-03', '2026-11-03', { allDay: true }),
      ev('late', '2026-11-05', '2026-11-05', { allDay: true }),
    ];
    const segs = packWeek(items, week);
    const by = Object.fromEntries(segs.map((s) => [s.item.id, s]));
    expect(by['long']).toMatchObject({ col: 0, span: 3, lane: 0 });
    expect(by['mid']?.lane).toBe(1);
    expect(by['late']).toMatchObject({ col: 3, lane: 0 });
  });

  it('clips items that run past the row and flags the continuation', () => {
    const [s] = packWeek([ev('x', '2026-11-07', '2026-11-12', { allDay: true })], week);
    expect(s).toMatchObject({ col: 5, span: 2, continuesAfter: true, continuesBefore: false });
    expect(packWeek([ev('y', '2026-11-20', '2026-11-21', { allDay: true })], week)).toHaveLength(0);
  });

  it('supports a single column (day view)', () => {
    expect(packWeek([ev('x', '2026-11-02T09:00', '2026-11-03T09:00')], '2026-11-03', 1)).toHaveLength(1);
  });
});

describe('timedBoxes', () => {
  it('places overlapping items side by side and leaves separate ones full width', () => {
    const items = [
      ev('a', '2026-11-05T10:00', '2026-11-05T11:00'),
      ev('b', '2026-11-05T10:30', '2026-11-05T12:00'),
      ev('c', '2026-11-05T13:00', '2026-11-05T14:00'),
    ];
    const boxes = timedBoxes(items, '2026-11-05');
    const by = Object.fromEntries(boxes.map((b) => [b.item.id, b]));
    expect(by['a']).toMatchObject({ col: 0, cols: 2 });
    expect(by['b']).toMatchObject({ col: 1, cols: 2 });
    expect(by['c']).toMatchObject({ col: 0, cols: 1 });
  });

  it('skips all-day and multi-day items and gives a task room', () => {
    const items = [
      ev('allday', '2026-11-05', '2026-11-05', { allDay: true }),
      ev('multi', '2026-11-05T20:00', '2026-11-06T08:00'),
      task('t', '2026-11-05T09:00'),
    ];
    const boxes = timedBoxes(items, '2026-11-05');
    expect(boxes.map((b) => b.item.id)).toEqual(['t']);
    expect(boxes[0]?.endMin).toBe(9 * 60 + 30);
  });
});

describe('groupTasks', () => {
  const opts = { today: '2026-11-04', weekStartsOn: 1 }; // Wednesday
  const keys = (items: CalendarItem[], o: Partial<Parameters<typeof groupTasks>[1]> = {}): string[] =>
    groupTasks(items, { ...opts, ...o }).map((g) => g.key);

  it('sorts tasks into the day buckets', () => {
    const items = [
      task('over', '2026-11-02T10:00'),
      task('today', '2026-11-04T10:00'),
      task('tomorrow', '2026-11-05T10:00'),
      task('week', '2026-11-07T10:00'),
      task('next', '2026-11-10T10:00'),
      task('later', '2026-11-30T10:00'),
      ev('ignored', '2026-11-04T10:00'),
    ];
    const groups = groupTasks(items, opts);
    expect(groups.map((g) => g.key)).toEqual(['overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'planned']);
    expect(groups.every((g) => g.items.length === 1)).toBe(true);
  });

  it('lists overdue tasks even outside the range, and sends closed past tasks to Earlier', () => {
    const items = [task('over', '2026-10-01T10:00'), task('done', '2026-11-02T10:00', { status: 'CLOSED' }), task('out', '2026-12-20T10:00')];
    expect(keys(items, { range: { start: '2026-11-01', end: '2026-11-30' } })).toEqual(['overdue', 'earlier']);
  });

  it('knows what overdue means', () => {
    expect(isOverdue(task('a', '2026-11-03T10:00'), '2026-11-04')).toBe(true);
    expect(isOverdue(task('a', '2026-11-04T10:00'), '2026-11-04')).toBe(false);
    expect(isOverdue(task('a', '2026-11-03T10:00', { status: 'CLOSED' }), '2026-11-04')).toBe(false);
    expect(isOverdue(ev('e', '2026-11-03T10:00'), '2026-11-04')).toBe(false);
  });

  it('puts the same week days in This week for Sunday-start weeks too', () => {
    expect(keys([task('sun', '2026-11-08T10:00')], { weekStartsOn: 0 })).toEqual(['nextWeek']);
    expect(keys([task('sun', '2026-11-08T10:00')], { weekStartsOn: 1 })).toEqual(['thisWeek']);
  });
});
