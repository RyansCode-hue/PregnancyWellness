# Code health pass (branch: baby-tab-and-reorder-arrows)

## Workouts
- [x] `isWorkoutDone` helper; use in getWorkoutProgress, getDayCombinedStatus, getWeeklyReport, DayDetail progress
- [x] Remove dead weekly branch in DayDetail handleToggleWorkout
- [x] Add `timesPerDay` for day-assigned workouts (session circles reused)
- [x] Fix optimistic decrement when today has 0 sessions

## Data bugs
- [x] Undo restores raw day record + dose source (not merged weekly record)
- [x] Link picker filters by frequency; drop mismatched links on save
- [x] partnerName actually used in reminders ({name} placeholder + migration)
- [x] Android channelId on reminder triggers
- [x] WhenToTakePicker uses theme colors
- [x] ThemeContext falls back to defaults on load failure (logged)
- [x] Linking.openURL failures surfaced; toggleDose/loadData rejections handled
- [x] getDaysUntilDue / getPregnancyWeek DST-safe
- [x] getLastCompletedWorkoutDates logs corrupt records

## Dead code
- [x] getMissedSupplementsList, TrashIcon, Supplement.dayOfWeek, getSupplementsForDate
- [x] dead style keys, availableYears, `|| true`
- [x] remove react-native-draggable-flatlist (+ reanimated)

## Duplication
- [x] One BFS cluster implementation
- [x] One Monday-of-week helper
- [x] Settings tab list from ALL_TAB_ORDER
- [x] Shared Calendar/DayDetail helpers (move handlers, getDoses, weekly merge)
- [x] Contraction "last 5" comments → 4
- [x] Inline require in DayDetail undo

## Finish
- [x] tsc clean
- [x] commit + push

## Review notes
- `npx tsc --noEmit` clean, also clean with `--noUnusedLocals --noUnusedParameters`.
- Storage logic exercised against a mocked AsyncStorage (week helpers, DST-safe day math,
  session counting for both workout frequencies, calendar status, weekly report, cross-frequency
  link rejection, display-vs-stored day record, reminder placeholder + legacy body migration).
- Follow-up pass: `makeStyles` calls memoized on `colors`; per-day AsyncStorage reads batched
  through `getDayRecords` / `getWorkoutDayRecords` (calendar month, weekly merges, weekly report);
  shared `ReorderColumn` and `TimeStepper` components replace the copy-pasted UI.
- Intentional behaviour (confirmed): a weekly supplement dose checked on one day cannot be
  unchecked from a different day of the same week.
