import {
  addDays, dayNum, groupTasks, isBanner, isOverdue, monthGrid, nowStamp, packWeek, shiftAnchor, spanOf, stampOf, timedBoxes,
  todayIso, visibleRange, weekDays,
  type CalendarItem, type DateRange, type IsoDate, type View, type WeekSegment,
} from '../core';
import { openDialog } from './dialog';
import { btn, el, fmtDayLong, fmtDayNumber, fmtHour, fmtMonthYear, fmtShort, fmtTime, fmtWeekday } from './dom';
import type { CalendarCallbacks, CalendarOptions, DateSelection } from './options';
import { renderPanel } from './panel';

const VIEWS: readonly View[] = ['month', 'week', 'day'];
const VIEW_LABEL: Record<View, string> = { month: 'Month', week: 'Week', day: 'Day' };
const HOUR_H = 48;
const SNAP_MIN = 30;
const MONTH_LANES = 3;
const STRIP_LANES = 4;
const DEFAULT_COLOR = '#6b7280';

interface Drag {
  kind: 'days' | 'time';
  /** days: first and current day number; time: first and current minute of `day` */
  a: number;
  b: number;
  day?: IsoDate;
  col?: HTMLElement;
}

export class CalendarView {
  private readonly root: HTMLElement;
  private readonly shell: HTMLElement;
  private items: CalendarItem[];
  private categories: Readonly<Record<string, string>>;
  private view: View;
  private anchor: IsoDate;
  private readonly weekStartsOn: number;
  private readOnly: boolean;
  private showTaskPanel: boolean;
  private readonly builtInDialog: boolean;
  private readonly scrollToHour: number;
  private readonly fixedToday: IsoDate | undefined;
  private readonly cb: CalendarCallbacks;
  private selectedId: string | null = null;
  private readonly collapsed = new Set<string>();
  private closeDialog: (() => void) | null = null;
  private lastRangeKey = '';
  private destroyed = false;
  private drag: Drag | null = null;
  private seq = 0;
  private bodyScroll: number | null = null;

  constructor(host: HTMLElement, options: CalendarOptions) {
    this.items = [...options.items];
    this.categories = options.categories ?? {};
    this.view = options.view ?? 'month';
    this.fixedToday = options.today;
    this.anchor = options.date ?? this.today();
    this.weekStartsOn = options.weekStartsOn ?? 1;
    this.readOnly = options.readOnly ?? false;
    this.showTaskPanel = options.showTaskPanel ?? true;
    this.builtInDialog = options.builtInDialog ?? true;
    this.scrollToHour = options.scrollToHour ?? 7;
    this.cb = options.callbacks ?? {};

    this.root = el('div', 'stl-c');
    this.shell = el('div', 'stl-c-shell');
    this.root.append(this.shell);
    host.append(this.root);

    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('mousedown', this.onMouseDown);
    this.root.addEventListener('mouseover', this.onMouseOver);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    this.render();
  }

  // -- public API -------------------------------------------------------------

  /** Replace the items (for example with what was just saved or loaded for the new range) */
  setData(items: readonly CalendarItem[]): void {
    this.items = [...items];
    if (this.selectedId && !this.items.some((i) => i.id === this.selectedId)) this.selectedId = null;
    this.render();
  }

  setView(view: View): void { this.view = view; this.render(); }
  getView(): View { return this.view; }
  /** Show the page that contains this day */
  goTo(date: IsoDate): void { this.anchor = date; this.render(); }
  getDate(): IsoDate { return this.anchor; }
  next(): void { this.anchor = shiftAnchor(this.view, this.anchor, 1); this.render(); }
  prev(): void { this.anchor = shiftAnchor(this.view, this.anchor, -1); this.render(); }
  goToToday(): void { this.anchor = this.today(); this.render(); }
  getRange(): DateRange { return visibleRange(this.view, this.anchor, this.weekStartsOn); }

  setReadOnly(readOnly: boolean): void { this.readOnly = readOnly; this.render(); }
  setShowTaskPanel(show: boolean): void { this.showTaskPanel = show; this.render(); }
  setCategories(categories: Readonly<Record<string, string>>): void { this.categories = categories; this.render(); }

  select(id: string | null): void { this.selectedId = id; this.render(); }
  getSelected(): string | null { return this.selectedId; }

  destroy(): void {
    this.destroyed = true;
    this.closeDialog?.();
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.root.remove();
  }

  // -- state helpers ------------------------------------------------------------

  private today(): IsoDate { return this.fixedToday ?? todayIso(); }
  private colorOf = (item: CalendarItem): string => this.categories[item.category ?? ''] ?? DEFAULT_COLOR;

  /**
   * Applies the edit on screen, then reports it. If the host's callback fails the screen goes back to what it
   * was (unless the host has replaced the data meanwhile).
   */
  private async commit(next: CalendarItem[], notify: () => void | Promise<unknown>): Promise<void> {
    const before = this.items;
    this.items = next;
    this.render();
    try {
      await notify();
    } catch (error) {
      if (this.destroyed) return;
      if (this.items === next) { this.items = before; this.render(); }
      this.cb.onError?.(error);
    }
  }

  private create(item: CalendarItem): void {
    void this.commit([...this.items, item], () => this.cb.onCreate?.(item));
  }

  private update(next: CalendarItem): void {
    const previous = this.items.find((i) => i.id === next.id);
    if (!previous) return;
    void this.commit(this.items.map((i) => (i.id === next.id ? next : i)), () => this.cb.onChange?.(next, previous));
  }

  private remove(id: string): void {
    if (this.selectedId === id) this.selectedId = null;
    void this.commit(this.items.filter((i) => i.id !== id), () => this.cb.onDelete?.(id));
  }

  private toggleTask(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item || this.readOnly) return;
    this.update({ ...item, status: item.status === 'CLOSED' ? 'OPEN' : 'CLOSED' });
  }

  // -- dialogs and picks ----------------------------------------------------------

  private openItem(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    this.selectedId = id;
    this.render();
    this.cb.onOpenItem?.(id);
    if (this.builtInDialog) this.showDialog(item, false);
  }

  private showDialog(item: CalendarItem, isNew: boolean): void {
    this.closeDialog?.();
    this.closeDialog = openDialog(this.root, {
      item, isNew, readOnly: this.readOnly, categories: this.categories,
      onSave: (next) => (isNew ? this.create(next) : this.update(next)),
      onDelete: () => this.remove(item.id),
      onClose: () => { this.closeDialog = null; },
    });
  }

  private pick(sel: DateSelection): void {
    if (this.readOnly) return;
    this.cb.onSelectRange?.(sel);
    if (!this.builtInDialog) return;
    const first = Object.keys(this.categories)[0];
    this.showDialog({
      id: `tmp-${++this.seq}`, type: 'EVENT', title: '', start: sel.start, end: sel.end, allDay: sel.allDay,
      status: 'OPEN', ...(first ? { category: first } : {}),
    }, true);
  }

  private newDefault(): void {
    const day = this.view === 'day' || this.view === 'week' ? this.anchor : this.today();
    this.pick({ start: `${day}T09:00`, end: `${day}T10:00`, allDay: false });
  }

  // -- events -----------------------------------------------------------------------

  private onClick = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    const toggle = t.closest<HTMLElement>('[data-toggle]');
    if (toggle) { this.toggleTask(toggle.dataset['toggle'] ?? ''); return; }
    const nav = t.closest<HTMLElement>('[data-nav]');
    if (nav) {
      const k = nav.dataset['nav'];
      if (k === 'prev') this.prev(); else if (k === 'next') this.next(); else this.goToToday();
      return;
    }
    const v = t.closest<HTMLElement>('[data-view]');
    if (v) { this.setView(v.dataset['view'] as View); return; }
    if (t.closest('[data-new]')) { this.newDefault(); return; }
    const g = t.closest<HTMLElement>('[data-group]');
    if (g) {
      const key = g.dataset['group'] ?? '';
      if (this.collapsed.has(key)) this.collapsed.delete(key); else this.collapsed.add(key);
      this.render();
      return;
    }
    const more = t.closest<HTMLElement>('[data-more]');
    if (more) { this.anchor = more.dataset['more'] ?? this.anchor; this.view = 'day'; this.render(); return; }
    const ev = t.closest<HTMLElement>('[data-id]');
    if (ev && !t.closest('.stl-c-overlay')) this.openItem(ev.dataset['id'] ?? '');
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.readOnly || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('.stl-c-ev, button, .stl-c-overlay')) return;
    const dayEl = t.closest<HTMLElement>('[data-day]');
    if (dayEl?.dataset['day']) {
      const n = dayNum(dayEl.dataset['day']);
      this.drag = { kind: 'days', a: n, b: n };
      this.paintDrag();
      return;
    }
    const col = t.closest<HTMLElement>('[data-col-day]');
    if (col?.dataset['colDay']) {
      const m = this.minuteAt(col, e.clientY);
      this.drag = { kind: 'time', a: m, b: m, day: col.dataset['colDay'], col };
      this.paintDrag();
    }
  };

  private onMouseOver = (e: MouseEvent): void => {
    if (this.drag?.kind !== 'days') return;
    const d = (e.target as HTMLElement).closest<HTMLElement>('[data-day]')?.dataset['day'];
    if (d) { this.drag.b = dayNum(d); this.paintDrag(); }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.drag?.kind !== 'time' || !this.drag.col) return;
    this.drag.b = this.minuteAt(this.drag.col, e.clientY);
    this.paintDrag();
  };

  private onMouseUp = (): void => {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.clearDragPaint();
    if (d.kind === 'days') {
      const [lo, hi] = d.a <= d.b ? [d.a, d.b] : [d.b, d.a];
      const iso = (n: number): IsoDate => addDays('1970-01-01', n);
      this.pick({ start: iso(lo), end: iso(hi), allDay: true });
    } else if (d.day) {
      const [lo, hi] = d.a <= d.b ? [d.a, d.b] : [d.b, d.a];
      const base = dayNum(d.day) * 1440;
      const endMin = lo === hi ? lo + 60 : hi + SNAP_MIN;
      this.pick({ start: stampOf(base + lo), end: stampOf(base + Math.min(1440, endMin)), allDay: false });
    }
  };

  private minuteAt(col: HTMLElement, clientY: number): number {
    const y = clientY - col.getBoundingClientRect().top;
    const min = Math.floor((y / HOUR_H) * 60 / SNAP_MIN) * SNAP_MIN;
    return Math.max(0, Math.min(1440 - SNAP_MIN, Number.isFinite(min) ? min : 0));
  }

  private paintDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.clearDragPaint();
    if (d.kind === 'days') {
      const [lo, hi] = d.a <= d.b ? [d.a, d.b] : [d.b, d.a];
      for (const c of this.root.querySelectorAll<HTMLElement>('[data-day]')) {
        const n = dayNum(c.dataset['day'] ?? '1970-01-01');
        if (n >= lo && n <= hi) c.classList.add('stl-c-sel');
      }
    } else if (d.col) {
      const [lo, hi] = d.a <= d.b ? [d.a, d.b] : [d.b, d.a];
      const end = lo === hi ? lo + 60 : hi + SNAP_MIN;
      const g = el('div', 'stl-c-ghost');
      g.style.top = `${(lo / 60) * HOUR_H}px`;
      g.style.height = `${((Math.min(1440, end) - lo) / 60) * HOUR_H}px`;
      d.col.append(g);
    }
  }

  private clearDragPaint(): void {
    for (const c of this.root.querySelectorAll('.stl-c-sel')) c.classList.remove('stl-c-sel');
    for (const g of this.root.querySelectorAll('.stl-c-ghost')) g.remove();
  }

  // -- drawing ------------------------------------------------------------------------

  private render(): void {
    if (this.destroyed) return;
    const old = this.shell.querySelector<HTMLElement>('.stl-c-scroll');
    if (old) this.bodyScroll = old.scrollTop;
    const range = this.getRange();

    const body = el('div', 'stl-c-body');
    const main = el('div', 'stl-c-main');
    main.append(this.view === 'month' ? this.renderMonth() : this.renderTimeGrid());
    body.append(main);
    if (this.showTaskPanel) {
      body.append(renderPanel({
        groups: groupTasks(this.items, { today: this.today(), weekStartsOn: this.weekStartsOn, range }),
        collapsed: this.collapsed, colorOf: this.colorOf, today: this.today(), readOnly: this.readOnly,
      }));
    }
    this.shell.replaceChildren(this.renderToolbar(), body);
    this.root.classList.toggle('stl-c-readonly', this.readOnly);

    const sc = this.shell.querySelector<HTMLElement>('.stl-c-scroll');
    if (sc) sc.scrollTop = this.bodyScroll ?? this.scrollToHour * HOUR_H;

    const key = `${this.view}|${range.start}|${range.end}`;
    if (key !== this.lastRangeKey) {
      this.lastRangeKey = key;
      queueMicrotask(() => { if (!this.destroyed) this.cb.onRangeChange?.(range, this.view); });
    }
  }

  private title(): string {
    if (this.view === 'month') return fmtMonthYear(this.anchor);
    if (this.view === 'day') return fmtDayLong(this.anchor);
    const days = weekDays(this.anchor, this.weekStartsOn);
    const a = days[0] as IsoDate;
    const b = days[6] as IsoDate;
    return `${fmtShort(a)} – ${fmtShort(b)} ${b.slice(0, 4)}`;
  }

  private renderToolbar(): HTMLElement {
    const bar = el('div', 'stl-c-toolbar');
    const nav = el('div', 'stl-c-group');
    nav.append(btn('‹', 'stl-c-btn', { 'data-nav': 'prev', 'aria-label': 'Previous' }), btn('›', 'stl-c-btn', { 'data-nav': 'next', 'aria-label': 'Next' }), btn('Today', 'stl-c-btn', { 'data-nav': 'today' }));
    const views = el('div', 'stl-c-group');
    for (const v of VIEWS) views.append(btn(VIEW_LABEL[v], `stl-c-btn${v === this.view ? ' stl-c-on' : ''}`, { 'data-view': v }));
    bar.append(nav, el('h2', 'stl-c-title', this.title()), el('span', 'stl-c-grow'), views);
    if (!this.readOnly) bar.append(btn('+ New', 'stl-c-btn stl-c-primary', { 'data-new': '1' }));
    return bar;
  }

  private itemEl(item: CalendarItem, kind: 'bar' | 'pill' | 'box' | 'marker', seg?: WeekSegment): HTMLElement {
    const closed = item.status === 'CLOSED';
    const cls = ['stl-c-ev', `stl-c-${kind}`];
    if (closed) cls.push('stl-c-closed');
    if (isOverdue(item, this.today())) cls.push('stl-c-overdue');
    if (item.id === this.selectedId) cls.push('stl-c-selected');
    if (item.type === 'TASK') cls.push('stl-c-isTask');
    if (seg?.continuesBefore) cls.push('stl-c-cb');
    if (seg?.continuesAfter) cls.push('stl-c-ca');
    const e = el('div', cls.join(' '));
    e.dataset['id'] = item.id;
    e.style.setProperty('--c', this.colorOf(item));
    const time = item.allDay ? '' : fmtTime(item.start);
    e.title = `${item.title}${time ? ` (${time})` : ''}`;
    const label = item.type === 'TASK' ? `◆ ${item.title}` : item.title;
    if (kind === 'pill' && item.type === 'EVENT' && time) e.append(el('span', 'stl-c-time', time), document.createTextNode(` ${label}`));
    else e.textContent = label;
    return e;
  }

  /** One row of day cells with the items laid over them (month weeks and the all-day strip) */
  private weekRow(days: readonly IsoDate[], items: readonly CalendarItem[], o: { numbers: boolean; maxLanes: number; outsideMonth?: string }): HTMLElement {
    const n = days.length;
    const row = el('div', `stl-c-wk${o.numbers ? ' stl-c-wkm' : ' stl-c-strip'}`);
    const cells = el('div', 'stl-c-cells');
    cells.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    const today = this.today();
    for (const d of days) {
      const c = el('div', 'stl-c-cell');
      c.dataset['day'] = d;
      if (d === today) c.classList.add('stl-c-today');
      if (o.outsideMonth && d.slice(0, 7) !== o.outsideMonth) c.classList.add('stl-c-out');
      if (o.numbers) c.append(el('span', 'stl-c-num', fmtDayNumber(d)));
      cells.append(c);
    }
    const layer = el('div', 'stl-c-layer');
    layer.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    const segs = packWeek(items, days[0] as IsoDate, n);
    const hidden = new Array<number>(n).fill(0);
    for (const s of segs) {
      if (s.lane >= o.maxLanes) {
        for (let c = s.col; c < s.col + s.span; c++) hidden[c] = (hidden[c] ?? 0) + 1;
        continue;
      }
      const sp = spanOf(s.item);
      const banner = !!sp && isBanner(sp);
      const e = this.itemEl(s.item, banner ? 'bar' : 'pill', s);
      e.style.gridColumn = `${s.col + 1} / span ${s.span}`;
      e.style.gridRow = String(s.lane + 1);
      layer.append(e);
    }
    hidden.forEach((count, c) => {
      if (count === 0) return;
      const m = btn(`+${count} more`, 'stl-c-more', { 'data-more': days[c] as string });
      m.style.gridColumn = String(c + 1);
      m.style.gridRow = String(o.maxLanes + 1);
      layer.append(m);
    });
    row.append(cells, layer);
    return row;
  }

  private renderMonth(): HTMLElement {
    const wrap = el('div', 'stl-c-month');
    const weeks = monthGrid(this.anchor, this.weekStartsOn);
    const head = el('div', 'stl-c-dow');
    for (const d of weeks[0] as IsoDate[]) head.append(el('div', '', fmtWeekday(d)));
    wrap.append(head);
    const month = this.anchor.slice(0, 7);
    for (const w of weeks) wrap.append(this.weekRow(w, this.items, { numbers: true, maxLanes: MONTH_LANES, outsideMonth: month }));
    return wrap;
  }

  private renderTimeGrid(): HTMLElement {
    const days = this.view === 'week' ? weekDays(this.anchor, this.weekStartsOn) : [this.anchor];
    const n = days.length;
    const today = this.today();
    const grid = el('div', 'stl-c-tg');

    const head = el('div', 'stl-c-tgrow');
    head.append(el('div', 'stl-c-gut'));
    const heads = el('div', 'stl-c-heads');
    heads.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    for (const d of days) {
      const h = el('div', `stl-c-dayh${d === today ? ' stl-c-today' : ''}`);
      h.append(el('span', '', fmtWeekday(d)), el('strong', '', fmtDayNumber(d)));
      heads.append(h);
    }
    head.append(heads);

    const banners = this.items.filter((i) => { const sp = spanOf(i); return !!sp && isBanner(sp); });
    const strip = el('div', 'stl-c-tgrow');
    strip.append(el('div', 'stl-c-gut stl-c-muted', 'all-day'), this.weekRow(days, banners, { numbers: false, maxLanes: STRIP_LANES }));

    const scroll = el('div', 'stl-c-scroll');
    const body = el('div', 'stl-c-tgrow stl-c-tgbody');
    const gut = el('div', 'stl-c-gut stl-c-hours');
    gut.style.height = `${24 * HOUR_H}px`;
    for (let h = 1; h < 24; h++) {
      const l = el('div', 'stl-c-hour', fmtHour(h));
      l.style.top = `${h * HOUR_H}px`;
      gut.append(l);
    }
    const cols = el('div', 'stl-c-cols');
    cols.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    const nowDate = nowStamp();
    for (const d of days) {
      const col = el('div', `stl-c-col${d === today ? ' stl-c-today' : ''}`);
      col.dataset['colDay'] = d;
      col.style.height = `${24 * HOUR_H}px`;
      for (const b of timedBoxes(this.items, d)) {
        const task = b.item.type === 'TASK';
        const e = this.itemEl(b.item, task ? 'marker' : 'box');
        e.style.top = `${(b.startMin / 60) * HOUR_H}px`;
        e.style.height = task ? '22px' : `${Math.max(18, ((b.endMin - b.startMin) / 60) * HOUR_H - 1)}px`;
        e.style.left = `${(b.col / b.cols) * 100}%`;
        e.style.width = `${100 / b.cols}%`;
        if (!task) e.append(el('div', 'stl-c-time', fmtTime(b.item.start)));
        col.append(e);
      }
      if (!this.fixedToday && d === nowDate.slice(0, 10)) {
        const line = el('div', 'stl-c-now');
        line.style.top = `${((Number(nowDate.slice(11, 13)) * 60 + Number(nowDate.slice(14, 16))) / 60) * HOUR_H}px`;
        col.append(line);
      }
      cols.append(col);
    }
    body.append(gut, cols);
    scroll.append(body);
    grid.append(head, strip, scroll);
    return grid;
  }
}
