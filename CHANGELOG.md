# Changelog

## 0.1.0

First release.

- Month / week / day views; events (timed, all-day, multi-day) and tasks (a due moment)
- Click a day or drag a range (days in month view, time slots in week / day view) to create
- Task panel: Overdue / Today / Tomorrow / This week / Next week / Planned, collapsible, tick to close
- Built-in create / edit / delete dialog (can be turned off in favour of your own)
- Optimistic edits that revert and call `onError` when a callback fails
- Read-only mode, category colours
- Pure core (`monthGrid`, `visibleRange`, `packWeek`, `timedBoxes`, `groupTasks`, ...) usable without the DOM
