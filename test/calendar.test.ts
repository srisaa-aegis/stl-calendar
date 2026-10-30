/** @jest-environment jsdom */
import { CalendarView } from '../src';
import type { CalendarItem } from '../src';

const items: CalendarItem[] = [
  { id: 'e1', type: 'EVENT', title: 'Kick-off', category: 'Sales', start: '2026-11-04T10:00', end: '2026-11-04T11:00' },
  { id: 'e2', type: 'EVENT', title: 'Trip', category: 'Travel', start: '2026-11-10', end: '2026-11-12', allDay: true },
  { id: 't1', type: 'TASK', title: 'Send proof', start: '2026-11-02T17:00', status: 'OPEN' },
  { id: 't2', type: 'TASK', title: 'Review BoQ', start: '2026-11-05T11:00', status: 'OPEN' },
];
const base = { items, categories: { Sales: '#3B82F6', Travel: '#8B5CF6' }, today: '2026-11-04', date: '2026-11-04' };

let host: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<div id="h"></div>'; host = document.getElementById('h') as HTMLElement; });
const q = <T extends Element>(sel: string): T => host.querySelector(sel) as T;
const qa = (sel: string): Element[] => Array.from(host.querySelectorAll(sel));
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const mouse = (target: Element, type: string): void => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 })); };

describe('CalendarView (DOM)', () => {
  it('draws the month grid with the items and the task panel', () => {
    const cal = new CalendarView(host, base);
    expect(qa('.stl-c-wk')).toHaveLength(6);
    expect(qa('.stl-c-cell')).toHaveLength(42);
    expect(q('.stl-c-title').textContent).toBe('November 2026');
    expect(qa('.stl-c-ev').map((e) => e.textContent)).toEqual(expect.arrayContaining(['Trip']));
    expect(qa('.stl-c-task')).toHaveLength(2);
    expect(q('.stl-c-ghead.stl-c-over')).not.toBeNull(); // t1 is overdue
    cal.destroy();
  });

  it('paints a bar in the item colour', () => {
    new CalendarView(host, base);
    const trip = qa('.stl-c-bar').find((e) => e.textContent === 'Trip') as HTMLElement;
    expect(trip.style.getPropertyValue('--c')).toBe('#8B5CF6');
  });

  it('switches view and moves between pages', () => {
    const cal = new CalendarView(host, base);
    cal.setView('week');
    expect(qa('.stl-c-col')).toHaveLength(7);
    expect(q('.stl-c-title').textContent).toBe('Nov 2 – Nov 8 2026');
    cal.next();
    expect(cal.getRange()).toEqual({ start: '2026-11-09', end: '2026-11-15' });
    cal.setView('day');
    expect(qa('.stl-c-col')).toHaveLength(1);
    q<HTMLElement>('[data-nav="today"]').click();
    expect(cal.getDate()).toBe('2026-11-04');
  });

  it('puts a timed event and a task on the time grid', () => {
    new CalendarView(host, { ...base, view: 'week' });
    expect(qa('.stl-c-box').map((e) => e.textContent)).toEqual([expect.stringContaining('Kick-off')]);
    expect(qa('.stl-c-marker').map((e) => e.textContent)).toEqual(['◆ Send proof', '◆ Review BoQ']);
  });

  it('reports the visible range once the calendar exists, and again after paging', async () => {
    const onRangeChange = jest.fn();
    const cal = new CalendarView(host, { ...base, callbacks: { onRangeChange } });
    await flush();
    expect(onRangeChange).toHaveBeenCalledWith({ start: '2026-10-26', end: '2026-12-06' }, 'month');
    cal.next();
    await flush();
    expect(onRangeChange).toHaveBeenCalledTimes(2);
  });

  it('opens the dialog from a day pick and creates an item', async () => {
    const onCreate = jest.fn();
    const onSelectRange = jest.fn();
    new CalendarView(host, { ...base, callbacks: { onCreate, onSelectRange } });
    const cell = qa('.stl-c-cell').find((c) => (c as HTMLElement).dataset['day'] === '2026-11-17') as Element;
    mouse(cell, 'mousedown');
    mouse(cell, 'mouseup');
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(onSelectRange).toHaveBeenCalledWith({ start: '2026-11-17', end: '2026-11-17', allDay: true });
    const subject = host.querySelector<HTMLInputElement>('.stl-c-dialog input') as HTMLInputElement;
    subject.value = 'Planning';
    q<HTMLElement>('.stl-c-btn.stl-c-primary:not([data-new])').click();
    await flush();
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Planning', start: '2026-11-17', allDay: true, type: 'EVENT' }));
    expect(qa('.stl-c-ev').some((e) => e.textContent === 'Planning')).toBe(true);
    expect(q('.stl-c-dialog')).toBeNull();
  });

  it('selects a range of days by dragging', () => {
    const onSelectRange = jest.fn();
    new CalendarView(host, { ...base, builtInDialog: false, callbacks: { onSelectRange } });
    const at = (d: string): Element => qa('.stl-c-cell').find((c) => (c as HTMLElement).dataset['day'] === d) as Element;
    mouse(at('2026-11-17'), 'mousedown');
    mouse(at('2026-11-19'), 'mouseover');
    expect(qa('.stl-c-sel')).toHaveLength(3);
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(onSelectRange).toHaveBeenCalledWith({ start: '2026-11-17', end: '2026-11-19', allDay: true });
    expect(q('.stl-c-dialog')).toBeNull();
  });

  it('ticks a task closed and reports the change', async () => {
    const onChange = jest.fn();
    new CalendarView(host, { ...base, callbacks: { onChange } });
    q<HTMLElement>('[data-toggle="t2"]').click();
    await flush();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 't2', status: 'CLOSED' }), expect.objectContaining({ id: 't2', status: 'OPEN' }));
    expect(q('.stl-c-task.stl-c-closed')).not.toBeNull();
  });

  it('puts the screen back and calls onError when the callback fails', async () => {
    const onError = jest.fn();
    new CalendarView(host, { ...base, callbacks: { onChange: () => { throw new Error('nope'); }, onError } });
    q<HTMLElement>('[data-toggle="t2"]').click();
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(q('.stl-c-task.stl-c-closed')).toBeNull();
    expect(q('[data-toggle="t2"]').textContent).toBe('☐');
  });

  it('edits and deletes through the dialog', async () => {
    const onChange = jest.fn();
    const onDelete = jest.fn();
    new CalendarView(host, { ...base, callbacks: { onChange, onDelete } });
    (qa('.stl-c-ev').find((e) => e.textContent === 'Trip') as HTMLElement).click();
    const subject = host.querySelector<HTMLInputElement>('.stl-c-dialog input') as HTMLInputElement;
    expect(subject.value).toBe('Trip');
    subject.value = 'Trip to Delhi';
    q<HTMLElement>('.stl-c-dialog .stl-c-primary').click();
    await flush();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2', title: 'Trip to Delhi' }), expect.objectContaining({ title: 'Trip' }));

    (qa('.stl-c-ev').find((e) => e.textContent === 'Trip to Delhi') as HTMLElement).click();
    q<HTMLElement>('.stl-c-dialog .stl-c-danger').click();
    await flush();
    expect(onDelete).toHaveBeenCalledWith('e2');
    expect(qa('.stl-c-ev').some((e) => e.textContent === 'Trip to Delhi')).toBe(false);
  });

  it('validates the dialog', () => {
    new CalendarView(host, base);
    q<HTMLElement>('[data-new]').click();
    q<HTMLElement>('.stl-c-dialog .stl-c-primary').click();
    expect(q('.stl-c-error').textContent).toBe('Subject is required');
    expect(q('.stl-c-dialog')).not.toBeNull();
  });

  it('read-only mode hides the New button, blocks picks and ticks, and shows details', () => {
    const onSelectRange = jest.fn();
    new CalendarView(host, { ...base, readOnly: true, callbacks: { onSelectRange } });
    expect(q('[data-new]')).toBeNull();
    const cell = qa('.stl-c-cell')[10] as Element;
    mouse(cell, 'mousedown');
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(onSelectRange).not.toHaveBeenCalled();
    expect(q<HTMLButtonElement>('[data-toggle="t2"]').disabled).toBe(true);
    (qa('.stl-c-ev')[0] as HTMLElement).click();
    expect(q('.stl-c-dialog .stl-c-primary')).toBeNull();
  });

  it('collapses a task group and can hide the panel', () => {
    const cal = new CalendarView(host, base);
    q<HTMLElement>('[data-group="overdue"]').click();
    expect(qa('.stl-c-task')).toHaveLength(1);
    cal.setShowTaskPanel(false);
    expect(q('.stl-c-panel')).toBeNull();
  });

  it('shows +n more and jumps to the day view', () => {
    const many: CalendarItem[] = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, type: 'EVENT' as const, title: `M${i}`, start: '2026-11-18', end: '2026-11-18', allDay: true }));
    const cal = new CalendarView(host, { ...base, items: many });
    const more = q<HTMLElement>('[data-more="2026-11-18"]');
    expect(more.textContent).toBe('+3 more');
    more.click();
    expect(cal.getView()).toBe('day');
    expect(cal.getDate()).toBe('2026-11-18');
  });

  it('removes itself on destroy', () => {
    const cal = new CalendarView(host, base);
    cal.destroy();
    expect(host.children).toHaveLength(0);
  });
});
