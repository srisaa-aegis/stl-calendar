import { CalendarView, addDays, todayIso } from '../src';
import type { CalendarItem } from '../src';

const CATEGORIES = { Sales: '#3B82F6', Project: '#10B981', Administration: '#F59E0B', Travel: '#8B5CF6' };

/** Sample data placed around the real today so the demo always looks alive */
const sample = (): CalendarItem[] => {
  const t = todayIso();
  const d = (n: number): string => addDays(t, n);
  return [
    { id: 'e1', type: 'EVENT', title: 'Tender kick-off call', category: 'Sales', start: `${d(0)}T10:00`, end: `${d(0)}T11:00`, owner: 'Asha' },
    { id: 'e2', type: 'EVENT', title: 'Client site visit', category: 'Project', start: `${d(0)}T10:30`, end: `${d(0)}T12:30`, owner: 'Ravi' },
    { id: 'e3', type: 'EVENT', title: 'Bid review', category: 'Sales', start: `${d(1)}T15:00`, end: `${d(1)}T16:30` },
    { id: 'e4', type: 'EVENT', title: 'Delhi trip', category: 'Travel', start: d(2), end: d(4), allDay: true },
    { id: 'e5', type: 'EVENT', title: 'Annual audit', category: 'Administration', start: d(-3), end: d(-2), allDay: true },
    { id: 'e6', type: 'EVENT', title: 'Vendor workshop', category: 'Project', start: `${d(5)}T09:00`, end: `${d(6)}T13:00` },
    { id: 'e7', type: 'EVENT', title: 'Stand-up', category: 'Project', start: `${d(0)}T09:00`, end: `${d(0)}T09:15` },
    { id: 'e8', type: 'EVENT', title: 'Team lunch', category: 'Administration', start: d(0), end: d(0), allDay: true },
    { id: 't1', type: 'TASK', title: 'Send EMD proof', category: 'Sales', start: `${d(-2)}T17:00`, status: 'OPEN', owner: 'Asha' },
    { id: 't2', type: 'TASK', title: 'Submit expense sheet', category: 'Administration', start: `${d(0)}T16:00`, status: 'OPEN' },
    { id: 't3', type: 'TASK', title: 'Review BoQ', category: 'Project', start: `${d(1)}T11:00`, status: 'OPEN', owner: 'Ravi' },
    { id: 't4', type: 'TASK', title: 'Update risk register', category: 'Project', start: `${d(3)}T12:00`, status: 'OPEN' },
    { id: 't5', type: 'TASK', title: 'Book flights', category: 'Travel', start: `${d(-1)}T10:00`, status: 'CLOSED' },
    { id: 't6', type: 'TASK', title: 'Prepare board deck', category: 'Administration', start: `${d(9)}T10:00`, status: 'OPEN' },
    { id: 't7', type: 'TASK', title: 'Renew licence', category: 'Administration', start: `${d(16)}T10:00`, status: 'OPEN' },
  ];
};

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const logBox = $('log');
const log = (s: string): void => { logBox.textContent = `${s}\n${logBox.textContent ?? ''}`; };
const fail = (): boolean => $<HTMLInputElement>('fail').checked;
const maybeFail = (): void => { if (fail()) throw new Error('The server said no'); };
const readOnly = location.hash === '#ro';
$<HTMLInputElement>('ro').checked = readOnly;
const hashView = ['week', 'day'].find((v) => location.hash === `#${v}`) as 'week' | 'day' | undefined;
$<HTMLSelectElement>('view').value = hashView ?? 'month';

const cal = new CalendarView($('c'), {
  items: sample(),
  categories: CATEGORIES,
  view: hashView ?? 'month',
  readOnly,
  callbacks: {
    onCreate: (item) => { log(`create  "${item.title}" ${item.type} ${item.start}${item.end ? ` -> ${item.end}` : ''}`); maybeFail(); },
    onChange: (item, prev) => { log(`change  "${item.title}" ${prev.status ?? '-'} -> ${item.status ?? '-'} (${item.start})`); maybeFail(); },
    onDelete: (id) => { log(`delete  ${id}`); maybeFail(); },
    onSelectRange: (s) => log(`select  ${s.start} -> ${s.end}${s.allDay ? ' (all day)' : ''}`),
    onOpenItem: (id) => log(`open    ${id}`),
    onRangeChange: (r, v) => log(`range   ${v} ${r.start} .. ${r.end}`),
    onError: (e) => log(`error   ${e instanceof Error ? e.message : String(e)} - the screen was put back`),
  },
});

$<HTMLSelectElement>('view').addEventListener('change', (e) => cal.setView((e.target as HTMLSelectElement).value as 'month' | 'week' | 'day'));
$('panel').addEventListener('change', (e) => cal.setShowTaskPanel((e.target as HTMLInputElement).checked));
$('ro').addEventListener('change', (e) => cal.setReadOnly((e.target as HTMLInputElement).checked));
$('reset').addEventListener('click', () => { cal.setData(sample()); log('reset to the sample data'); });
