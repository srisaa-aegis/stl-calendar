# stl-calendar

A dependency-free TypeScript calendar. Plain DOM, no framework, MIT licensed.

- Month, week and day views
- Events (timed, all-day, multi-day) and tasks (a due moment), coloured by category
- Click a day or drag over days (month) or time slots (week / day) to create
- Tasks panel: Overdue / Today / Tomorrow / This week / Next week / Planned, collapsible, tick a task to close it
- Built-in create / edit / delete dialog (or turn it off and build your own)
- Read-only mode
- A pure core (`monthGrid`, `visibleRange`, `packWeek`, `timedBoxes`, `groupTasks`, ...) you can use without the DOM, for example on a server

## Install

```
npm install stl-calendar
```

## Use

```ts
import { CalendarView } from 'stl-calendar';
import 'stl-calendar/style.css';

const cal = new CalendarView(document.getElementById('calendar')!, {
  items: [
    { id: 'e1', type: 'EVENT', title: 'Kick-off', category: 'Sales', start: '2026-11-04T10:00', end: '2026-11-04T11:00' },
    { id: 't1', type: 'TASK', title: 'Send proof', category: 'Sales', start: '2026-11-05T17:00', status: 'OPEN' },
  ],
  categories: { Sales: '#3B82F6', Project: '#10B981' },
  callbacks: {
    onRangeChange: async (range) => cal.setData(await load(range)),
    onCreate: async (item) => { await save(item); cal.setData(await load(cal.getRange())); },
    onChange: async (item) => { await update(item); },
    onDelete: async (id) => { await remove(id); },
  },
});
```

The calendar never saves anything. It applies each edit on screen, then calls your callback. If the callback throws,
the screen is put back and `onError` is called. Call `setData` with the saved data to refresh.

Dates are ISO days (`2026-11-05`); times are local, without a time zone (`2026-11-05T14:30`). An item's `start` is an
event's start or a task's due moment. For an all-day event set `allDay: true`; its `end` is the last day (inclusive).
For a timed event `end` is the end moment (an hour is assumed when it is missing).

### Items

| Field | Meaning |
|---|---|
| `id`, `type`, `title` | `type` is `'EVENT'` or `'TASK'` |
| `start`, `end`, `allDay` | When (see above). `end` is ignored for tasks |
| `category` | Looks up the colour in `categories` |
| `status` | `'OPEN'` or `'CLOSED'` (tasks and events). An open task due on an earlier day is shown as overdue |
| `description`, `owner`, `meta` | Shown in the dialog; `meta` is handed back untouched |

### Options

| Option | Meaning |
|---|---|
| `items` | The data (copied on the way in) |
| `categories` | `{ name: colour }`; also fills the category list in the dialog |
| `view`, `date` | `'month' \| 'week' \| 'day'`, and any day inside the page to show |
| `weekStartsOn` | 0 = Sunday, 1 = Monday (default) ... |
| `readOnly` | No creating, editing, deleting or ticking |
| `showTaskPanel` | The Tasks panel (default true) |
| `builtInDialog` | Open the built-in dialog (default true). Turn off to use `onSelectRange` / `onOpenItem` for your own |
| `scrollToHour`, `today` | Hour the week / day view opens at (default 7); override "today" (useful in tests) |
| `callbacks` | `onCreate`, `onChange`, `onDelete`, `onSelectRange`, `onOpenItem`, `onRangeChange`, `onError` |

`onRangeChange(range, view)` is called once after the calendar is created and after every page or view change, so
you can load just what is visible.

### Methods

`setData`, `setView`, `getView`, `goTo`, `getDate`, `next`, `prev`, `goToToday`, `getRange`, `setReadOnly`,
`setShowTaskPanel`, `setCategories`, `select`, `getSelected`, `destroy`.

### Theming

Every colour is a CSS variable on `.stl-c` (`--stl-bg`, `--stl-fg`, `--stl-line`, `--stl-accent`, `--stl-today`, ...).
Category colours come from the `categories` option.

### The core without the DOM

```ts
import { groupTasks, monthGrid, packWeek, timedBoxes, visibleRange } from 'stl-calendar';

visibleRange('month', '2026-11-05', 1);              // { start: '2026-10-26', end: '2026-12-06' }
groupTasks(items, { today: '2026-11-04', weekStartsOn: 1 });
```

## Demo

```
npm install
npm run demo      # bundles demo/main.ts into demo/calendar.js
```

Open `demo/index.html`. It shows the full calendar on sample data and logs every callback. Open it as
`index.html#week`, `#day` or `#ro` for another starting view or read-only. "Make saves fail" shows the screen
reverting when a callback throws.

## Develop

```
npm run typecheck
npm test
npm run build
```

## Licence

MIT. Copyright (c) 2026 Srisaa Technologies (OPC) Private Limited.

## Credits

Created and maintained by Srisaa Technologies (OPC) Private Limited.
