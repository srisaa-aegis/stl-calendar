import { absMinutes, datePart, isStamp, timePart, type CalendarItem, type ItemStatus, type ItemType } from '../core';
import { btn, el } from './dom';

export interface DialogOptions {
  /** The item being edited, or the starting values of a new one */
  item: CalendarItem;
  isNew: boolean;
  readOnly: boolean;
  categories: Readonly<Record<string, string>>;
  onSave: (item: CalendarItem) => void;
  onDelete: () => void;
  onClose: () => void;
}

function field(label: string, control: HTMLElement): HTMLElement {
  const w = el('label', 'stl-c-field');
  w.append(el('span', 'stl-c-flabel', label), control);
  return w;
}

function select(options: ReadonlyArray<[string, string]>, value: string): HTMLSelectElement {
  const s = el('select');
  for (const [v, label] of options) {
    const o = el('option', '', label);
    o.value = v;
    s.append(o);
  }
  s.value = value;
  return s;
}

function input(type: string, value: string): HTMLInputElement {
  const i = el('input');
  i.type = type;
  i.value = value;
  return i;
}

/** Create / edit / view dialog drawn inside the calendar. Returns a function that closes it. */
export function openDialog(root: HTMLElement, o: DialogOptions): () => void {
  const it = o.item;
  const overlay = el('div', 'stl-c-overlay');
  const box = el('div', 'stl-c-dialog');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  overlay.append(box);

  const title = o.readOnly ? 'Details' : o.isNew ? 'New activity' : 'Edit activity';
  box.append(el('h3', 'stl-c-dtitle', title));

  const typeSel = select([['EVENT', 'Event'], ['TASK', 'Task']], it.type);
  const subject = input('text', it.title);
  subject.maxLength = 255;
  const desc = el('textarea');
  desc.rows = 3;
  desc.value = it.description ?? '';
  const catKeys = Object.keys(o.categories);
  const cat = select([['', '(none)'], ...catKeys.map((k): [string, string] => [k, k])], it.category ?? '');
  const allDay = input('checkbox', '');
  allDay.checked = it.allDay === true;
  const start = input('text', '');
  const end = input('text', '');
  const statusSel = select([['OPEN', 'Open'], ['CLOSED', 'Closed']], it.status ?? 'OPEN');
  const owner = input('text', it.owner ?? '');
  const err = el('div', 'stl-c-error');

  const startLabel = el('span', 'stl-c-flabel');
  const startWrap = el('label', 'stl-c-field');
  startWrap.append(startLabel, start);
  const endWrap = field('End', end);
  const allDayWrap = el('label', 'stl-c-check');
  allDayWrap.append(allDay, el('span', '', 'All day'));

  // The date inputs change kind with the type and the all-day switch; keep what was typed when possible.
  let lastStart = it.start;
  let lastEnd = it.end ?? it.start;
  const sync = (): void => {
    const isTask = typeSel.value === 'TASK';
    const dateOnly = !isTask && allDay.checked;
    const kind = dateOnly ? 'date' : 'datetime-local';
    for (const [inp, prev] of [[start, lastStart], [end, lastEnd]] as const) {
      inp.type = kind;
      const date = datePart(prev);
      inp.value = dateOnly ? date : `${date}T${timePart(prev)}`;
    }
    startLabel.textContent = isTask ? 'Due *' : 'Start *';
    endWrap.hidden = isTask;
    allDayWrap.hidden = isTask;
  };
  const remember = (): void => { lastStart = start.value || lastStart; lastEnd = end.value || lastEnd; };
  typeSel.addEventListener('change', () => { remember(); sync(); });
  allDay.addEventListener('change', () => { remember(); sync(); });
  start.addEventListener('change', remember);
  end.addEventListener('change', remember);
  sync();

  const form = el('div', 'stl-c-form');
  form.append(field('Type', typeSel), field('Subject *', subject), field('Description', desc));
  if (catKeys.length > 0) form.append(field('Category', cat));
  form.append(allDayWrap, startWrap, endWrap);
  if (!o.isNew) form.append(field('Status', statusSel));
  form.append(field('Assigned to', owner), err);
  box.append(form);

  if (o.readOnly) for (const c of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')) c.disabled = true;

  const actions = el('div', 'stl-c-actions');
  const close = (): void => { document.removeEventListener('keydown', onKey); overlay.remove(); o.onClose(); };

  const save = (): void => {
    const isTask = typeSel.value === 'TASK';
    const dateOnly = !isTask && allDay.checked;
    if (!subject.value.trim()) { err.textContent = 'Subject is required'; return; }
    if (!isStamp(start.value)) { err.textContent = `${isTask ? 'Due' : 'Start'} is required`; return; }
    let endValue: string | null = null;
    if (!isTask) {
      if (!isStamp(end.value)) { err.textContent = 'End is required'; return; }
      if (absMinutes(end.value) < absMinutes(start.value)) { err.textContent = 'End must not be before start'; return; }
      endValue = end.value;
    }
    const next: CalendarItem = {
      ...it,
      type: typeSel.value as ItemType,
      title: subject.value.trim(),
      description: desc.value.trim() || null,
      category: cat.value || null,
      start: start.value,
      end: endValue,
      allDay: dateOnly,
      status: (o.isNew ? (it.status ?? 'OPEN') : statusSel.value) as ItemStatus,
      owner: owner.value.trim() || null,
    };
    close();
    o.onSave(next);
  };

  if (!o.readOnly) {
    if (!o.isNew) {
      const del = btn('Delete', 'stl-c-btn stl-c-danger');
      del.addEventListener('click', () => { close(); o.onDelete(); });
      actions.append(del);
    }
    actions.append(el('span', 'stl-c-grow'));
  } else {
    actions.append(el('span', 'stl-c-grow'));
  }
  const cancel = btn(o.readOnly ? 'Close' : 'Cancel', 'stl-c-btn');
  cancel.addEventListener('click', close);
  actions.append(cancel);
  if (!o.readOnly) {
    const ok = btn(o.isNew ? 'Create' : 'Update', 'stl-c-btn stl-c-primary');
    ok.addEventListener('click', save);
    actions.append(ok);
  }
  box.append(actions);

  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  root.append(overlay);
  subject.focus();
  return close;
}
