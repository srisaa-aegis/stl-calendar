/** A calendar day, "2026-11-05". */
export type IsoDate = string;
/** A local date and time, "2026-11-05T14:30" (no time zone). A bare IsoDate is also accepted where a time is not needed. */
export type IsoDateTime = string;

export type View = 'month' | 'week' | 'day';
export type ItemType = 'EVENT' | 'TASK';
export type ItemStatus = 'OPEN' | 'CLOSED';

export interface CalendarItem {
  id: string;
  type: ItemType;
  title: string;
  description?: string | null;
  /** Picks the colour (see `categories` in the options) */
  category?: string | null;
  /** An event's start, or a task's due moment. "2026-11-05" or "2026-11-05T14:30" */
  start: IsoDateTime;
  /** An event's end. For an all-day event it is the last day (inclusive); for a timed event the end moment. Ignored for tasks. */
  end?: IsoDateTime | null;
  allDay?: boolean;
  /** A task still OPEN after its due day is shown as overdue; the host does not need to set that */
  status?: ItemStatus | null;
  owner?: string | null;
  /** Anything the host application wants handed back in callbacks */
  meta?: unknown;
}

/** Inclusive on both ends */
export interface DateRange { start: IsoDate; end: IsoDate }
