import type { CalendarItem, DateRange, IsoDate, IsoDateTime, View } from '../core';

/** What the person picked by clicking or dragging on the calendar */
export interface DateSelection {
  start: IsoDateTime;
  /** For an all-day pick this is the last day (inclusive) */
  end: IsoDateTime;
  allDay: boolean;
}

type Maybe = void | Promise<unknown>;

/**
 * The calendar never saves anything itself. It applies each edit on screen straight away, then tells the host
 * through these callbacks. If a callback throws or rejects, the calendar puts the screen back as it was and calls
 * `onError`.
 */
export interface CalendarCallbacks {
  /** The built-in dialog saved a new item. `item.id` is temporary: call `setData` with the saved data. */
  onCreate?: (item: CalendarItem) => Maybe;
  /** An item was edited, or a task was ticked / unticked */
  onChange?: (item: CalendarItem, previous: CalendarItem) => Maybe;
  onDelete?: (id: string) => Maybe;
  /** A day or a range was picked (also called when the built-in dialog opens for it) */
  onSelectRange?: (selection: DateSelection) => void;
  /** An item (or a task in the panel) was clicked */
  onOpenItem?: (id: string) => void;
  /** The visible dates changed (also once after the calendar is created): load the items for this range */
  onRangeChange?: (range: DateRange, view: View) => void;
  onError?: (error: unknown) => void;
}

export interface CalendarOptions {
  items: readonly CalendarItem[];
  /** Category name to colour, e.g. `{ Sales: '#3B82F6' }`. Also fills the category list in the dialog. */
  categories?: Readonly<Record<string, string>>;
  view?: View;
  /** Any day inside the page to show (defaults to today) */
  date?: IsoDate;
  /** 0 = Sunday, 1 = Monday (the default) ... */
  weekStartsOn?: number;
  /** No clicking to create, no editing, no deleting, no ticking tasks */
  readOnly?: boolean;
  /** The Tasks panel beside the calendar (default true) */
  showTaskPanel?: boolean;
  /** Open the built-in create / edit dialog (default true). Turn off to build your own from `onSelectRange` / `onOpenItem`. */
  builtInDialog?: boolean;
  /** Hour the week / day view is scrolled to (default 7) */
  scrollToHour?: number;
  /** Treat this day as "today" (defaults to the real one) */
  today?: IsoDate;
  callbacks?: CalendarCallbacks;
}

export type { View };
