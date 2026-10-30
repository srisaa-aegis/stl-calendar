import type { CalendarItem, TaskGroup } from '../core';
import { el, fmtShort, fmtTime } from './dom';

export interface PanelOptions {
  groups: readonly TaskGroup[];
  collapsed: ReadonlySet<string>;
  colorOf: (item: CalendarItem) => string;
  today: string;
  readOnly: boolean;
}

/** The Tasks panel. Clicks are handled by the calendar through the data-* attributes set here. */
export function renderPanel(o: PanelOptions): HTMLElement {
  const panel = el('aside', 'stl-c-panel');
  const total = o.groups.reduce((n, g) => n + g.items.length, 0);

  const head = el('div', 'stl-c-phead');
  head.append(el('strong', '', 'Tasks'), el('span', 'stl-c-muted', `${total} ${total === 1 ? 'item' : 'items'}`));
  panel.append(head);

  const body = el('div', 'stl-c-pbody');
  if (o.groups.length === 0) body.append(el('div', 'stl-c-empty', 'No open tasks in this period'));
  for (const g of o.groups) {
    const collapsed = o.collapsed.has(g.key);
    const gh = el('button', `stl-c-ghead${g.key === 'overdue' ? ' stl-c-over' : ''}`);
    gh.type = 'button';
    gh.dataset['group'] = g.key;
    gh.setAttribute('aria-expanded', String(!collapsed));
    gh.append(el('span', '', `${collapsed ? '▸' : '▾'} ${g.label}`), el('span', 'stl-c-count', String(g.items.length)));
    body.append(gh);
    if (collapsed) continue;
    for (const item of g.items) {
      const closed = item.status === 'CLOSED';
      const row = el('div', `stl-c-task${closed ? ' stl-c-closed' : ''}`);
      row.dataset['id'] = item.id;
      const tick = el('button', 'stl-c-tick', closed ? '☑' : '☐');
      tick.type = 'button';
      tick.dataset['toggle'] = item.id;
      tick.title = closed ? 'Reopen' : 'Mark as closed';
      tick.setAttribute('aria-label', tick.title);
      tick.disabled = o.readOnly;
      const main = el('div', 'stl-c-tmain');
      main.append(el('div', 'stl-c-ttitle', item.title));
      const when = `${fmtShort(item.start)}${item.start.length > 10 ? ` ${fmtTime(item.start)}` : ''}`;
      main.append(el('div', 'stl-c-muted', item.owner ? `${when} · ${item.owner}` : when));
      const dot = el('span', 'stl-c-dot');
      dot.style.background = o.colorOf(item);
      row.append(tick, main, dot);
      body.append(row);
    }
  }
  panel.append(body);
  return panel;
}
