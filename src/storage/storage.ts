import AsyncStorage from '@react-native-async-storage/async-storage';
import { Supplement, DayRecord, DoseSourceRecord, Workout, WorkoutDayRecord, WorkoutFrequency, AppSettings, ReminderConfig, DEFAULT_SETTINGS, LaborItem, LaborStage, Contraction, FeedingSession, SleepSession, DiaperEvent, FeedSide, FeedHold, DiaperKind, AmountUnit } from '../types';
import { LABOR_SEED } from '../data/laborSeed';

const SUPPLEMENTS_KEY = 'supplements';
const WORKOUTS_KEY = 'workouts';
const SETTINGS_KEY = 'app_settings';
const DAY_PREFIX = 'day:';
const WORKOUT_DAY_PREFIX = 'workout_day:';
const DOSE_SOURCE_PREFIX = 'dose_source:';
const INSTALL_DATE_KEY = 'app_install_date';
const LABOR_KEY = 'labor_items';
// Bump this when LABOR_SEED changes so existing installs pick up new images / entries.
// User-added items (IDs without the 'seed-' prefix) are preserved across re-seeds.
const LABOR_SEEDED_KEY = 'labor_seeded_v5';
const CONTRACTIONS_KEY = 'contractions';
const FEEDINGS_KEY = 'baby_feedings';
const SLEEPS_KEY = 'baby_sleeps';
const DIAPERS_KEY = 'baby_diapers';

// ─── Settings ───

function newReminderId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// Reminder bodies may contain this token; it is replaced with `partnerName` when the
// notification is scheduled so the name can change without re-editing every reminder.
export const REMINDER_NAME_PLACEHOLDER = '{name}';

export function renderReminderBody(body: string, partnerName: string): string {
  return body.split(REMINDER_NAME_PLACEHOLDER).join(partnerName.trim() || 'there');
}

// Bodies written by earlier builds hardcoded the default partner name. Map them onto
// the placeholder so the name setting takes effect for existing installs.
const LEGACY_REMINDER_BODIES: Record<string, string> = {
  'Hey Amy, remember to take your supplements today!':
    'Hey {name}, remember to take your supplements today!',
  'Hey Amy, have you taken all your supplements today?':
    'Hey {name}, have you taken all your supplements today?',
};

export async function getSettings(): Promise<AppSettings> {
  const json = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!json) {
    return { ...DEFAULT_SETTINGS, reminders: DEFAULT_SETTINGS.reminders.map((r) => ({ ...r })) };
  }
  const stored: any = JSON.parse(json);

  // Migrate legacy morningReminder/eveningReminder → reminders[]
  let reminders: ReminderConfig[] | undefined = stored.reminders;
  if (!Array.isArray(reminders)) {
    reminders = [];
    if (stored.morningReminder) {
      reminders.push({
        id: 'morning',
        hour: 8,
        minute: 0,
        title: 'Good morning!',
        body: 'Hey there, remember to take your supplements today!',
        ...stored.morningReminder,
      });
    }
    if (stored.eveningReminder) {
      reminders.push({
        id: 'evening',
        hour: 20,
        minute: 0,
        title: 'Evening check-in',
        body: 'Have you taken all your supplements today?',
        ...stored.eveningReminder,
      });
    }
    if (reminders.length === 0) {
      reminders = DEFAULT_SETTINGS.reminders.map((r) => ({ ...r }));
    }
  } else {
    reminders = reminders.map((r) => ({
      ...r,
      // Defensive: ensure every reminder has an id
      id: r.id || newReminderId(),
      body: LEGACY_REMINDER_BODIES[r.body] ?? r.body,
    }));
  }

  // Drop the legacy keys when returning, so they stop round-tripping through saveSettings.
  const { morningReminder, eveningReminder, ...rest } = stored;
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    reminders,
    // Per-key merge so legacy installs (and future tabs added to ToggleableTab) always have
    // every key present. A stored object missing one key would otherwise break tab visibility.
    enabledTabs: {
      ...DEFAULT_SETTINGS.enabledTabs,
      ...(rest.enabledTabs ?? {}),
    },
  };
}

export function createReminder(partial?: Partial<ReminderConfig>): ReminderConfig {
  return {
    id: newReminderId(),
    hour: 9,
    minute: 0,
    title: 'Reminder',
    body: 'Take your supplements',
    ...partial,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Supplements CRUD ───

export async function getSupplements(): Promise<Supplement[]> {
  const json = await AsyncStorage.getItem(SUPPLEMENTS_KEY);
  if (!json) return [];
  const supplements: Supplement[] = JSON.parse(json);
  // Backfill sortOrder from stored array index for legacy installs.
  return supplements
    .map((s, i) => ({
      ...s,
      frequency: s.frequency || 'daily',
      linkedSupplementIds: s.linkedSupplementIds || [],
      sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : i,
    }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function saveSupplement(supplement: Supplement): Promise<void> {
  const supplements = await getSupplements();
  const index = supplements.findIndex((s) => s.id === supplement.id);
  const oldLinked = index >= 0 ? (supplements[index].linkedSupplementIds || []) : [];

  // Linked supplements must share a frequency: the Weekly Report and list sections
  // treat a cluster as a unit with one frequency, so a mixed cluster would be split.
  const requestedLinks = supplement.linkedSupplementIds || [];
  const newLinked = requestedLinks.filter((id) => {
    const other = supplements.find((x) => x.id === id);
    if (!other) return false;
    if (other.frequency !== supplement.frequency) {
      console.warn(
        `saveSupplement: dropping link ${supplement.id} -> ${id}: frequency mismatch ` +
          `(${supplement.frequency} vs ${other.frequency})`,
      );
      return false;
    }
    return true;
  });
  supplement = { ...supplement, linkedSupplementIds: newLinked };

  if (index >= 0) {
    // Preserve existing sortOrder on update unless caller explicitly set one
    const next = { ...supplement };
    if (typeof next.sortOrder !== 'number') {
      next.sortOrder = supplements[index].sortOrder;
    }
    supplements[index] = next;
  } else {
    // Append new items at the end
    if (typeof supplement.sortOrder !== 'number') {
      const maxOrder = supplements.reduce(
        (m, s) => Math.max(m, s.sortOrder ?? 0),
        -1,
      );
      supplement = { ...supplement, sortOrder: maxOrder + 1 };
    }
    supplements.push(supplement);
  }

  // Ensure bidirectional linking
  // Add this supplement's ID to any newly linked supplements
  for (const linkedId of newLinked) {
    const linkedSup = supplements.find((s) => s.id === linkedId);
    if (linkedSup) {
      const linkedIds = linkedSup.linkedSupplementIds || [];
      if (!linkedIds.includes(supplement.id)) {
        linkedSup.linkedSupplementIds = [...linkedIds, supplement.id];
      }
    }
  }

  // Remove this supplement's ID from any unlinked supplements
  const removed = oldLinked.filter((id) => !newLinked.includes(id));
  for (const removedId of removed) {
    const linkedSup = supplements.find((s) => s.id === removedId);
    if (linkedSup && linkedSup.linkedSupplementIds) {
      linkedSup.linkedSupplementIds = linkedSup.linkedSupplementIds.filter(
        (id) => id !== supplement.id,
      );
    }
  }

  await AsyncStorage.setItem(SUPPLEMENTS_KEY, JSON.stringify(supplements));
}

// Persist a new ordering for supplements. Pass IDs in the desired display order;
// each supplement's sortOrder is reassigned to its index. IDs not in the list
// keep their previous sortOrder (placed after the explicitly-ordered ones).
export async function saveSupplementOrder(orderedIds: string[]): Promise<void> {
  const supplements = await getSupplements();
  const indexById = new Map<string, number>();
  orderedIds.forEach((id, i) => indexById.set(id, i));
  const tail = orderedIds.length;
  let tailCursor = 0;
  const next = supplements.map((s) => {
    const idx = indexById.get(s.id);
    if (typeof idx === 'number') return { ...s, sortOrder: idx };
    return { ...s, sortOrder: tail + tailCursor++ };
  });
  await AsyncStorage.setItem(SUPPLEMENTS_KEY, JSON.stringify(next));
}

export async function deleteSupplement(id: string): Promise<void> {
  const supplements = await getSupplements();
  // Remove this supplement's ID from any linked supplements
  for (const sup of supplements) {
    if (sup.linkedSupplementIds) {
      sup.linkedSupplementIds = sup.linkedSupplementIds.filter((lid) => lid !== id);
    }
  }
  const filtered = supplements.filter((s) => s.id !== id);
  await AsyncStorage.setItem(SUPPLEMENTS_KEY, JSON.stringify(filtered));
}

// ─── Week helpers (weeks are Monday-start) ───

// Local-midnight Date for the Monday of the week containing `date`.
export function getWeekStart(date: Date): Date {
  const day = date.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() + mondayOffset);
  return monday;
}

// Get the Monday..Sunday range containing the given date
export function getWeekRange(dateStr: string): { start: string; end: string } {
  const monday = getWeekStart(parseDate(dateStr));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

// The 7 YYYY-MM-DD strings of the week containing `dateStr`, Monday first.
export function getWeekDates(dateStr: string): string[] {
  const monday = getWeekStart(parseDate(dateStr));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

// Check how many weekly supplement doses are completed this week
export async function getWeeklyProgress(
  supplements: Supplement[],
  dateStr: string,
): Promise<{ completed: number; total: number }> {
  const weeklySups = supplements.filter((s) => s.frequency === 'weekly');
  if (weeklySups.length === 0) return { completed: 0, total: 0 };

  const weekDates = getWeekDates(dateStr);
  let totalDoses = 0;
  let completedDoses = 0;

  for (const sup of weeklySups) {
    totalDoses += sup.dosesPerDay;
    let supCompleted = 0;
    for (const ds of weekDates) {
      const record = await getDayRecord(ds);
      const doses = record[sup.id];
      if (doses) {
        supCompleted += doses.filter(Boolean).length;
      }
    }
    completedDoses += Math.min(supCompleted, sup.dosesPerDay);
  }

  return { completed: completedDoses, total: totalDoses };
}

// Get daily supplement progress for a specific date
export async function getDailyProgress(
  supplements: Supplement[],
  dateStr: string,
): Promise<{ completed: number; total: number }> {
  const dailySups = supplements.filter((s) => s.frequency === 'daily');
  if (dailySups.length === 0) return { completed: 0, total: 0 };

  const record = await getDayRecord(dateStr);
  let totalDoses = 0;
  let completedDoses = 0;

  for (const sup of dailySups) {
    totalDoses += sup.dosesPerDay;
    const doses = record[sup.id];
    if (doses) {
      completedDoses += doses.filter(Boolean).length;
    }
  }

  return { completed: completedDoses, total: totalDoses };
}

// ─── Workouts CRUD ───

export async function getWorkouts(): Promise<Workout[]> {
  const json = await AsyncStorage.getItem(WORKOUTS_KEY);
  if (!json) return [];
  const workouts: Workout[] = JSON.parse(json);
  // Backfill: workouts saved before frequency existed default to 'days'.
  // Backfill sortOrder from stored array index for legacy installs.
  return workouts
    .map((w, i) => ({
      ...w,
      frequency: w.frequency || 'days',
      assignedDays: w.assignedDays || [],
      sortOrder: typeof w.sortOrder === 'number' ? w.sortOrder : i,
    }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function saveWorkout(workout: Workout): Promise<void> {
  const workouts = await getWorkouts();
  const index = workouts.findIndex((w) => w.id === workout.id);
  if (index >= 0) {
    const next = { ...workout };
    if (typeof next.sortOrder !== 'number') {
      next.sortOrder = workouts[index].sortOrder;
    }
    workouts[index] = next;
  } else {
    if (typeof workout.sortOrder !== 'number') {
      const maxOrder = workouts.reduce(
        (m, w) => Math.max(m, w.sortOrder ?? 0),
        -1,
      );
      workout = { ...workout, sortOrder: maxOrder + 1 };
    }
    workouts.push(workout);
  }
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
}

export async function saveWorkoutOrder(orderedIds: string[]): Promise<void> {
  const workouts = await getWorkouts();
  const indexById = new Map<string, number>();
  orderedIds.forEach((id, i) => indexById.set(id, i));
  const tail = orderedIds.length;
  let tailCursor = 0;
  const next = workouts.map((w) => {
    const idx = indexById.get(w.id);
    if (typeof idx === 'number') return { ...w, sortOrder: idx };
    return { ...w, sortOrder: tail + tailCursor++ };
  });
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(next));
}

export async function deleteWorkout(id: string): Promise<void> {
  const workouts = await getWorkouts();
  const filtered = workouts.filter((w) => w.id !== id);
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(filtered));
}

// ─── Workout progress ───

// Sessions logged for one workout on one day. Records written before the session
// counter existed only carry `completed`; treat that as a single session.
export function getWorkoutSessions(item: WorkoutDayRecord[string] | undefined): number {
  if (!item) return 0;
  return item.sessions ?? (item.completed ? 1 : 0);
}

// Sessions a single day needs before the workout counts as done for that day.
// Weekly-goal workouts are done for the day after one session; the goal itself is
// tracked across the week by `getWeeklyWorkoutCount`.
export function getWorkoutDayTarget(workout: Workout): number {
  return workout.frequency === 'days' ? Math.max(1, workout.timesPerDay ?? 1) : 1;
}

export function isWorkoutDoneOnDay(
  workout: Workout,
  item: WorkoutDayRecord[string] | undefined,
): boolean {
  return getWorkoutSessions(item) >= getWorkoutDayTarget(workout);
}

// Per-day progress from an already-loaded record. Day-assigned workouts contribute
// their per-day target to the total (partial sessions count toward completion).
// Weekly-goal workouts only contribute when logged today (bonus, not penalty).
export function computeWorkoutProgress(
  todayWorkouts: Workout[],
  record: WorkoutDayRecord,
): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const w of todayWorkouts) {
    const sessions = getWorkoutSessions(record[w.id]);
    if (w.frequency === 'weekly') {
      if (sessions > 0) {
        completed++;
        total++;
      }
    } else {
      const target = getWorkoutDayTarget(w);
      total += target;
      completed += Math.min(sessions, target);
    }
  }
  return { completed, total };
}

export async function getWorkoutProgress(
  workouts: Workout[],
  dateStr: string,
): Promise<{ completed: number; total: number }> {
  const todayWorkouts = getWorkoutsForDate(workouts, dateStr);
  if (todayWorkouts.length === 0) return { completed: 0, total: 0 };
  const record = await getWorkoutDayRecord(dateStr);
  return computeWorkoutProgress(todayWorkouts, record);
}

// ─── Workout filtering for a given date ───
// Day-assigned workouts: only on their assigned days.
// Weekly-goal workouts: shown every day (so the user can log on whichever day).
export function getWorkoutsForDate(
  workouts: Workout[],
  dateStr: string,
): Workout[] {
  const date = parseDate(dateStr);
  const dayOfWeek = date.getDay();
  return workouts.filter((w) => {
    if (w.frequency === 'weekly') return true;
    return w.assignedDays.includes(dayOfWeek as any);
  });
}

// For each given workout ID, find the most recent date the workout was completed
// (any session logged or 'completed: true'). Returns YYYY-MM-DD strings.
// Scans all workout_day:* keys via a single multiGet for efficiency.
export async function getLastCompletedWorkoutDates(
  workoutIds: string[],
): Promise<Record<string, string>> {
  if (workoutIds.length === 0) return {};
  const allKeys = await AsyncStorage.getAllKeys();
  const dayKeys = allKeys.filter((k) => k.startsWith(WORKOUT_DAY_PREFIX));
  if (dayKeys.length === 0) return {};
  const entries = await AsyncStorage.multiGet(dayKeys);
  const result: Record<string, string> = {};
  const idSet = new Set(workoutIds);
  for (const [key, val] of entries) {
    if (!val) continue;
    const date = key.substring(WORKOUT_DAY_PREFIX.length);
    let record: WorkoutDayRecord;
    try {
      record = JSON.parse(val) as WorkoutDayRecord;
    } catch (err) {
      console.error(`Corrupt workout record at ${key}; skipping`, err);
      continue;
    }
    for (const wid of Object.keys(record)) {
      if (!idSet.has(wid)) continue;
      const done = getWorkoutSessions(record[wid]) > 0;
      if (done && (!result[wid] || date > result[wid])) {
        result[wid] = date;
      }
    }
  }
  return result;
}

// Sum sessions across the week (Mon-Sun containing dateStr) for a weekly-goal
// workout. Sessions can stack on the same day.
export async function getWeeklyWorkoutCount(
  workoutId: string,
  dateStr: string,
): Promise<number> {
  let count = 0;
  for (const ds of getWeekDates(dateStr)) {
    const record = await getWorkoutDayRecord(ds);
    count += getWorkoutSessions(record[workoutId]);
  }
  return count;
}

// Week session counts keyed by workout id, for the weekly-goal workouts in `workouts`.
export async function getWeeklyWorkoutCounts(
  workouts: Workout[],
  dateStr: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const w of workouts) {
    if (w.frequency === 'weekly') {
      counts[w.id] = await getWeeklyWorkoutCount(w.id, dateStr);
    }
  }
  return counts;
}

// ─── Workout Day Records ───

function workoutDayKey(date: string): string {
  return `${WORKOUT_DAY_PREFIX}${date}`;
}

export async function getWorkoutDayRecord(date: string): Promise<WorkoutDayRecord> {
  const json = await AsyncStorage.getItem(workoutDayKey(date));
  return json ? JSON.parse(json) : {};
}

export async function saveWorkoutDayRecord(
  date: string,
  record: WorkoutDayRecord,
): Promise<void> {
  await AsyncStorage.setItem(workoutDayKey(date), JSON.stringify(record));
}

async function setWorkoutSessions(
  date: string,
  workoutId: string,
  sessions: number,
): Promise<WorkoutDayRecord> {
  const record = await getWorkoutDayRecord(date);
  const current = record[workoutId] ?? { completed: false };
  const next = Math.max(0, sessions);
  record[workoutId] = { ...current, sessions: next, completed: next > 0 };
  await saveWorkoutDayRecord(date, record);
  return record;
}

// Add one session to the day's count.
export async function incrementWorkoutSessions(
  date: string,
  workoutId: string,
): Promise<WorkoutDayRecord> {
  const record = await getWorkoutDayRecord(date);
  return setWorkoutSessions(date, workoutId, getWorkoutSessions(record[workoutId]) + 1);
}

// Remove one session from the day's count (floor at 0).
export async function decrementWorkoutSessions(
  date: string,
  workoutId: string,
): Promise<WorkoutDayRecord> {
  const record = await getWorkoutDayRecord(date);
  return setWorkoutSessions(date, workoutId, getWorkoutSessions(record[workoutId]) - 1);
}

export async function saveWorkoutNotes(
  date: string,
  workoutId: string,
  notes: string,
): Promise<WorkoutDayRecord> {
  const record = await getWorkoutDayRecord(date);
  if (!record[workoutId]) {
    record[workoutId] = { completed: false, notes };
  } else {
    record[workoutId] = { ...record[workoutId], notes };
  }
  await saveWorkoutDayRecord(date, record);
  return record;
}

// ─── Day Records (Supplements) ───

function dayKey(date: string): string {
  return `${DAY_PREFIX}${date}`;
}

export async function getDayRecord(date: string): Promise<DayRecord> {
  const json = await AsyncStorage.getItem(dayKey(date));
  return json ? JSON.parse(json) : {};
}

export async function saveDayRecord(date: string, record: DayRecord): Promise<void> {
  await AsyncStorage.setItem(dayKey(date), JSON.stringify(record));
}

// ─── Dose Source Records (tracks which supplement was actually taken) ───

function doseSourceKey(date: string): string {
  return `${DOSE_SOURCE_PREFIX}${date}`;
}

export async function getDoseSourceRecord(date: string): Promise<DoseSourceRecord> {
  const json = await AsyncStorage.getItem(doseSourceKey(date));
  return json ? JSON.parse(json) : {};
}

export async function saveDoseSourceRecord(date: string, record: DoseSourceRecord): Promise<void> {
  await AsyncStorage.setItem(doseSourceKey(date), JSON.stringify(record));
}

export async function toggleDose(
  date: string,
  supplementId: string,
  doseIndex: number,
  dosesPerDay: number,
): Promise<DayRecord> {
  const record = await getDayRecord(date);
  const sourceRecord = await getDoseSourceRecord(date);

  if (!record[supplementId]) {
    record[supplementId] = new Array(dosesPerDay).fill(false);
  }
  const newValue = !record[supplementId][doseIndex];
  record[supplementId][doseIndex] = newValue;

  // Track which supplement was actually taken for this dose
  if (!sourceRecord[supplementId]) {
    sourceRecord[supplementId] = new Array(dosesPerDay).fill(null);
  }
  sourceRecord[supplementId][doseIndex] = newValue ? supplementId : null;

  // Also toggle linked supplements to match
  const supplements = await getSupplements();
  const thisSup = supplements.find((s) => s.id === supplementId);
  if (thisSup?.linkedSupplementIds && thisSup.linkedSupplementIds.length > 0) {
    for (const linkedId of thisSup.linkedSupplementIds) {
      const linkedSup = supplements.find((s) => s.id === linkedId);
      if (linkedSup) {
        if (!record[linkedId]) {
          record[linkedId] = new Array(linkedSup.dosesPerDay).fill(false);
        }
        if (!sourceRecord[linkedId]) {
          sourceRecord[linkedId] = new Array(linkedSup.dosesPerDay).fill(null);
        }
        // Only sync if the dose index exists on the linked supplement
        if (doseIndex < linkedSup.dosesPerDay) {
          record[linkedId][doseIndex] = newValue;
          // The source for the linked supplement is the supplement that was actually taken
          sourceRecord[linkedId][doseIndex] = newValue ? supplementId : null;
        }
      }
    }
  }

  await saveDayRecord(date, record);
  await saveDoseSourceRecord(date, sourceRecord);
  return record;
}

// ─── Calendar helpers ───

export type DayStatusType = 'complete' | 'incomplete' | 'none';

export interface DayCombinedStatus {
  supplement: DayStatusType;
  workout: DayStatusType;
}

export async function getDayCombinedStatus(
  date: string,
  supplements: Supplement[],
  workouts: Workout[],
): Promise<DayCombinedStatus> {
  // Supplement status — only track daily supplements per-day on calendar
  const dailySups = supplements.filter((s) => s.frequency === 'daily');
  let supStatus: DayStatusType = 'none';
  if (dailySups.length > 0) {
    const record = await getDayRecord(date);
    let allComplete = true;
    for (const sup of dailySups) {
      const doses = record[sup.id];
      if (!doses || doses.filter(Boolean).length < sup.dosesPerDay) {
        allComplete = false;
        break;
      }
    }
    supStatus = allComplete ? 'complete' : 'incomplete';
  }

  // Workout status.
  // Day-assigned workouts drive incomplete/complete (red X if any are missed).
  // Weekly-goal workouts are bonus: a green check on days you actually did one,
  // but they never cause a red X on a day where you didn't.
  const dayAssigned = workouts.filter(
    (w) => w.frequency === 'days' && w.assignedDays.includes(parseDate(date).getDay() as any),
  );
  const goalWorkouts = workouts.filter((w) => w.frequency === 'weekly');

  let workoutStatus: DayStatusType = 'none';
  const workoutRecord =
    dayAssigned.length > 0 || goalWorkouts.length > 0
      ? await getWorkoutDayRecord(date)
      : {};

  if (dayAssigned.length > 0) {
    let allComplete = true;
    for (const workout of dayAssigned) {
      if (!isWorkoutDoneOnDay(workout, workoutRecord[workout.id])) {
        allComplete = false;
        break;
      }
    }
    workoutStatus = allComplete ? 'complete' : 'incomplete';
  }

  // If no day-assigned workouts but a weekly-goal workout was done today, mark green.
  if (
    workoutStatus === 'none' &&
    goalWorkouts.some((w) => isWorkoutDoneOnDay(w, workoutRecord[w.id]))
  ) {
    workoutStatus = 'complete';
  }

  return { supplement: supStatus, workout: workoutStatus };
}

export async function getMonthStatuses(
  year: number,
  month: number,
  supplements: Supplement[],
  workouts: Workout[],
): Promise<Record<string, DayCombinedStatus>> {
  const statuses: Record<string, DayCombinedStatus> = {};
  const today = new Date();
  const todayStr = formatDate(today);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);
    if (dateStr <= todayStr) {
      statuses[dateStr] = await getDayCombinedStatus(dateStr, supplements, workouts);
    }
  }

  return statuses;
}

// ─── Pregnancy week helpers ───

// Whole calendar days from `from` to `to`, ignoring time of day. Computed on UTC
// day numbers so a DST transition inside the range cannot skew the result.
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

export function getPregnancyWeek(dueDate: string): { week: number; day: number } | null {
  if (!dueDate) return null;
  // Gestational age counts from the LMP, 280 days before the due date.
  const totalDays = 280 - daysBetween(new Date(), parseDate(dueDate));

  if (totalDays < 0 || totalDays > 300) return null;

  const week = Math.floor(totalDays / 7);
  const day = totalDays % 7;
  return { week, day };
}

export function getDaysUntilDue(dueDate: string): number | null {
  if (!dueDate) return null;
  return daysBetween(new Date(), parseDate(dueDate));
}

// ─── Weekly supplement dose aggregation ───

// Merges weekly supplement dose records across the entire week (Mon-Sun).
// If a dose was checked on any day during the week, it shows as checked on all days.
export async function getWeeklySupplementDoses(
  dateStr: string,
  supplements: Supplement[],
): Promise<DayRecord> {
  const weeklySups = supplements.filter((s) => s.frequency === 'weekly');
  if (weeklySups.length === 0) return {};

  const merged: DayRecord = {};

  // Initialize merged record with false arrays
  for (const sup of weeklySups) {
    merged[sup.id] = new Array(sup.dosesPerDay).fill(false);
  }

  // Scan all 7 days and merge checked doses
  for (const ds of getWeekDates(dateStr)) {
    const record = await getDayRecord(ds);

    for (const sup of weeklySups) {
      const doses = record[sup.id];
      if (doses) {
        for (let j = 0; j < doses.length && j < sup.dosesPerDay; j++) {
          if (doses[j]) {
            merged[sup.id][j] = true;
          }
        }
      }
    }
  }

  return merged;
}

// The record a day screen should display: the day's own doses for daily supplements,
// with weekly supplements replaced by their week-merged doses. Never write this back
// to storage — it contains checks that belong to other days of the week.
export async function getDisplayDayRecord(
  dateStr: string,
  supplements: Supplement[],
): Promise<DayRecord> {
  const record = await getDayRecord(dateStr);
  const weeklyDoses = await getWeeklySupplementDoses(dateStr, supplements);
  return { ...record, ...weeklyDoses };
}

// ─── Install date tracking ───

export async function getInstallDate(): Promise<string> {
  const stored = await AsyncStorage.getItem(INSTALL_DATE_KEY);
  if (stored) return stored;
  const today = formatDate(new Date());
  await AsyncStorage.setItem(INSTALL_DATE_KEY, today);
  return today;
}

// ─── Weekly Report ───

export interface WeeklyReportSupSourceBreakdown {
  name: string;
  completed: number;
  total: number;
}

export interface WeeklyReportSupItem {
  name: string;
  frequency: 'daily' | 'weekly';
  completedDoses: number;
  totalDoses: number;
  /** If this item represents a linked group, contains per-supplement breakdowns */
  sourceBreakdown?: WeeklyReportSupSourceBreakdown[];
}

export interface WeeklyReportWorkoutItem {
  name: string;
  completedDays: number;
  totalDays: number;
  /** 'days' = scheduled on specific weekdays; 'weekly' = N-times-per-week goal */
  frequency: WorkoutFrequency;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  supplements: WeeklyReportSupItem[];
  workouts: WeeklyReportWorkoutItem[];
}

export async function getWeeklyReport(weekStartDate: string): Promise<WeeklyReport> {
  const startDate = parseDate(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const weekEnd = formatDate(endDate);

  const supplements = await getSupplements();
  const workouts = await getWorkouts();

  const supItems: WeeklyReportSupItem[] = [];

  // Pre-load day records and dose source records for all 7 days
  const dayRecords: { date: string; record: DayRecord; sources: DoseSourceRecord }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const ds = formatDate(d);
    dayRecords.push({
      date: ds,
      record: await getDayRecord(ds),
      sources: await getDoseSourceRecord(ds),
    });
  }

  // Process each linked cluster. saveSupplement guarantees a cluster shares one frequency.
  for (const cluster of buildSupplementClusters(supplements)) {
    const frequency = cluster[0].frequency;
    const isDaily = frequency === 'daily';

    // Per-supplement completed counts and totals
    const perSup: Record<string, { name: string; completed: number; total: number }> = {};
    for (const sup of cluster) {
      const total = isDaily ? sup.dosesPerDay * 7 : sup.dosesPerDay;
      perSup[sup.id] = { name: sup.name, completed: 0, total };
    }

    // Count completed doses per supplement, using dose source to attribute to the right one
    for (const sup of cluster) {
      for (const day of dayRecords) {
        const doses = day.record[sup.id];
        const sources = day.sources[sup.id];
        if (!doses) continue;
        for (let di = 0; di < doses.length; di++) {
          if (doses[di]) {
            // Which supplement was actually taken for this dose slot?
            const sourceId = sources?.[di] || sup.id;
            // Only count if the source is in this cluster
            if (perSup[sourceId]) {
              perSup[sourceId].completed++;
            } else {
              // Fallback: attribute to the supplement itself
              perSup[sup.id].completed++;
            }
          }
        }
      }
    }

    // For weekly supplements, cap each at its dosesPerDay
    if (!isDaily) {
      for (const sup of cluster) {
        perSup[sup.id].completed = Math.min(perSup[sup.id].completed, sup.dosesPerDay);
      }
    }

    if (cluster.length === 1) {
      // Single supplement (not linked) — no breakdown needed
      const sup = cluster[0];
      const info = perSup[sup.id];
      supItems.push({
        name: sup.name,
        frequency,
        completedDoses: info.completed,
        totalDoses: info.total,
      });
    } else {
      // Linked group — combined row with per-supplement breakdown
      // The combined total = one supplement's total (they share doses)
      const primarySup = cluster[0];
      const combinedTotal = isDaily ? primarySup.dosesPerDay * 7 : primarySup.dosesPerDay;

      // Combined completed = sum of all sources attributed to supplements in this cluster,
      // but only from ONE supplement's dose slots (since linked supplements mirror each other)
      let combinedCompleted = 0;
      for (const day of dayRecords) {
        const doses = day.record[primarySup.id];
        if (!doses) continue;
        for (let di = 0; di < doses.length; di++) {
          if (doses[di]) combinedCompleted++;
        }
      }
      if (!isDaily) combinedCompleted = Math.min(combinedCompleted, primarySup.dosesPerDay);

      // Per-source breakdown: count how many doses were attributed to each supplement
      const sourceBreakdown: WeeklyReportSupSourceBreakdown[] = [];
      const sourceCounts: Record<string, number> = {};
      for (const sup of cluster) sourceCounts[sup.id] = 0;

      for (const day of dayRecords) {
        const doses = day.record[primarySup.id];
        const sources = day.sources[primarySup.id];
        if (!doses) continue;
        for (let di = 0; di < doses.length; di++) {
          if (doses[di]) {
            const sourceId = sources?.[di] || primarySup.id;
            if (sourceCounts[sourceId] !== undefined) {
              sourceCounts[sourceId]++;
            } else {
              sourceCounts[primarySup.id]++;
            }
          }
        }
      }

      for (const sup of cluster) {
        sourceBreakdown.push({
          name: sup.name,
          completed: sourceCounts[sup.id] || 0,
          total: combinedCompleted, // out of how many were taken total
        });
      }

      const groupName = cluster.map((s) => s.name).join(' / ');
      supItems.push({
        name: groupName,
        frequency,
        completedDoses: combinedCompleted,
        totalDoses: combinedTotal,
        sourceBreakdown,
      });
    }
  }

  // Workouts:
  //  - 'days' workouts: count how many assigned days reached their per-day target
  //  - 'weekly' goal workouts: sessions logged across the whole week, capped at goal
  const workoutItems: WeeklyReportWorkoutItem[] = [];
  for (const workout of workouts) {
    if (workout.frequency === 'weekly') {
      const goal = workout.weeklyGoal ?? 1;
      const sessions = await getWeeklyWorkoutCount(workout.id, weekStartDate);
      workoutItems.push({
        name: workout.name,
        completedDays: Math.min(sessions, goal),
        totalDays: goal,
        frequency: 'weekly',
      });
    } else {
      let completedDays = 0;
      let totalDays = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dayOfWeek = d.getDay();
        if (workout.assignedDays.includes(dayOfWeek as any)) {
          totalDays++;
          const ds = formatDate(d);
          const record = await getWorkoutDayRecord(ds);
          if (isWorkoutDoneOnDay(workout, record[workout.id])) {
            completedDays++;
          }
        }
      }
      if (totalDays > 0) {
        workoutItems.push({ name: workout.name, completedDays, totalDays, frequency: 'days' });
      }
    }
  }

  return {
    weekStart: weekStartDate,
    weekEnd,
    supplements: supItems,
    workouts: workoutItems,
  };
}

// Get all available week start dates from install date to current week
export async function getAvailableWeeks(): Promise<string[]> {
  const installDate = await getInstallDate();
  const firstMonday = getWeekStart(parseDate(installDate));
  const currentMonday = getWeekStart(new Date());

  const weeks: string[] = [];
  const cursor = new Date(firstMonday);
  while (cursor <= currentMonday) {
    weeks.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks.reverse(); // most recent first
}

// ─── Date utils ───

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

// ─── Linked supplement clustering ───

// Build connected-component clusters (BFS): if A links B and B links C, {A,B,C} is one
// cluster. Links to ids outside `sectionSupplements` are ignored, so passing a
// frequency section yields clusters for that section only. This is the single
// implementation used for list ordering, arrow reordering and the Weekly Report.
export function buildSupplementClusters(sectionSupplements: Supplement[]): Supplement[][] {
  const idToSup = new Map<string, Supplement>();
  for (const s of sectionSupplements) idToSup.set(s.id, s);
  const visited = new Set<string>();
  const clusters: Supplement[][] = [];
  for (const sup of sectionSupplements) {
    if (visited.has(sup.id)) continue;
    const cluster: Supplement[] = [];
    const queue: string[] = [sup.id];
    visited.add(sup.id);
    while (queue.length > 0) {
      const cid = queue.shift()!;
      const c = idToSup.get(cid);
      if (!c) continue;
      cluster.push(c);
      for (const linkedId of c.linkedSupplementIds || []) {
        if (!visited.has(linkedId) && idToSup.has(linkedId)) {
          visited.add(linkedId);
          queue.push(linkedId);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

// Groups linked supplements so they appear adjacent in lists.
export function groupLinkedSupplements(supplements: Supplement[]): Supplement[] {
  if (supplements.length <= 1) return supplements;
  return buildSupplementClusters(supplements).flat();
}

// ─── Reorder helpers (arrow-button replacement for drag-and-drop) ───

// Move the cluster containing `targetId` up or down by one cluster position
// within its section. Linked supplements travel as a unit. Returns the unchanged
// reference if the cluster is already at the edge (so callers can detect no-ops).
export function moveSupplementClusterInSection(
  sectionSupplements: Supplement[],
  targetId: string,
  direction: 'up' | 'down',
): Supplement[] {
  const clusters = buildSupplementClusters(sectionSupplements);
  const targetIdx = clusters.findIndex((c) => c.some((s) => s.id === targetId));
  if (targetIdx < 0) return sectionSupplements;
  if (direction === 'up' && targetIdx === 0) return sectionSupplements;
  if (direction === 'down' && targetIdx === clusters.length - 1) return sectionSupplements;
  const otherIdx = direction === 'up' ? targetIdx - 1 : targetIdx + 1;
  const next = clusters.slice();
  [next[targetIdx], next[otherIdx]] = [next[otherIdx], next[targetIdx]];
  return next.flat();
}

// Returns whether the cluster containing `targetId` sits at the first / last
// position in its section. Used by the UI to disable arrow buttons at the edges.
export function getSupplementClusterEdges(
  sectionSupplements: Supplement[],
  targetId: string,
): { isFirst: boolean; isLast: boolean } {
  const clusters = buildSupplementClusters(sectionSupplements);
  const targetIdx = clusters.findIndex((c) => c.some((s) => s.id === targetId));
  if (targetIdx < 0) return { isFirst: true, isLast: true };
  return { isFirst: targetIdx === 0, isLast: targetIdx === clusters.length - 1 };
}

// Swap a workout with its neighbor in the given list. No clustering — workouts
// don't link. Returns the unchanged reference if already at the edge.
export function moveWorkoutInList(
  workouts: Workout[],
  targetId: string,
  direction: 'up' | 'down',
): Workout[] {
  const idx = workouts.findIndex((w) => w.id === targetId);
  if (idx < 0) return workouts;
  if (direction === 'up' && idx === 0) return workouts;
  if (direction === 'down' && idx === workouts.length - 1) return workouts;
  const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
  const next = workouts.slice();
  [next[idx], next[otherIdx]] = [next[otherIdx], next[idx]];
  return next;
}

// ─── Labor items ───

export async function getLaborItems(): Promise<LaborItem[]> {
  const seeded = await AsyncStorage.getItem(LABOR_SEEDED_KEY);
  if (!seeded) {
    // First run (or seed bump): refresh seed-prefixed entries from LABOR_SEED,
    // preserving any items the user added themselves.
    const existingJson = await AsyncStorage.getItem(LABOR_KEY);
    const existing: LaborItem[] = existingJson ? JSON.parse(existingJson) : [];
    const userAdded = existing.filter((i) => !i.id.startsWith('seed-'));
    const merged = [...LABOR_SEED, ...userAdded];
    await AsyncStorage.setItem(LABOR_KEY, JSON.stringify(merged));
    await AsyncStorage.setItem(LABOR_SEEDED_KEY, '1');
    return merged;
  }
  const json = await AsyncStorage.getItem(LABOR_KEY);
  if (!json) return [];
  return JSON.parse(json) as LaborItem[];
}

export async function saveLaborItem(item: LaborItem): Promise<void> {
  const items = await getLaborItems();
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  await AsyncStorage.setItem(LABOR_KEY, JSON.stringify(items));
}

export async function deleteLaborItem(id: string): Promise<void> {
  const items = await getLaborItems();
  const filtered = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(LABOR_KEY, JSON.stringify(filtered));
}

// ─── Contractions ───

export async function getContractions(): Promise<Contraction[]> {
  const json = await AsyncStorage.getItem(CONTRACTIONS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveContractions(list: Contraction[]): Promise<void> {
  await AsyncStorage.setItem(CONTRACTIONS_KEY, JSON.stringify(list));
}

export async function addContraction(start: string): Promise<Contraction> {
  const list = await getContractions();
  const item: Contraction = {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    start,
  };
  list.push(item);
  await saveContractions(list);
  return item;
}

export async function endContraction(id: string, end: string): Promise<void> {
  const list = await getContractions();
  const idx = list.findIndex((c) => c.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], end };
    await saveContractions(list);
  }
}

export async function deleteContraction(id: string): Promise<void> {
  const list = await getContractions();
  await saveContractions(list.filter((c) => c.id !== id));
}

export async function clearContractions(): Promise<void> {
  await AsyncStorage.removeItem(CONTRACTIONS_KEY);
}

// Estimate which labor stage you're in based on the last 4 completed
// contractions. Classification is by inter-start interval (minutes):
//   < 3 min  → transition
//   3–5 min  → active
//   ≥ 5 min  → early
// (Pushing isn't a timer stage — by then you've stopped tracking.)
// Returns null when there isn't enough data (need ≥ 4 completed contractions).
export interface StageEstimate {
  stage: LaborStage | null;
  avgDurationSec: number;
  avgIntervalMin: number;
  sampleSize: number;
}

export function estimateLaborStage(contractions: Contraction[]): StageEstimate {
  const completed = contractions.filter((c) => c.end);
  const recent = completed.slice(-4);
  if (recent.length < 4) {
    return {
      stage: null,
      avgDurationSec: 0,
      avgIntervalMin: 0,
      sampleSize: recent.length,
    };
  }

  const intervals: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const ms =
      new Date(recent[i].start).getTime() - new Date(recent[i - 1].start).getTime();
    intervals.push(ms / 60000);
  }
  const avgIntervalMin = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  const durations = recent.map(
    (c) => (new Date(c.end!).getTime() - new Date(c.start).getTime()) / 1000,
  );
  const avgDurationSec = durations.reduce((a, b) => a + b, 0) / durations.length;

  let stage: LaborStage;
  if (avgIntervalMin < 3) stage = 'transition';
  else if (avgIntervalMin < 5) stage = 'active';
  else stage = 'early';

  return { stage, avgDurationSec, avgIntervalMin, sampleSize: recent.length };
}

// ─── Baby ───

function babyId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Feedings — breast sessions have a timer (start, then end); bottle feeds are instant
// (end === start) and carry an amount.
export async function getFeedings(): Promise<FeedingSession[]> {
  const json = await AsyncStorage.getItem(FEEDINGS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveFeedings(list: FeedingSession[]): Promise<void> {
  await AsyncStorage.setItem(FEEDINGS_KEY, JSON.stringify(list));
}

export async function startBreastFeeding(
  start: string,
  side: FeedSide,
  hold?: FeedHold,
  holdCustom?: string,
): Promise<FeedingSession> {
  const list = await getFeedings();
  const item: FeedingSession = {
    id: babyId('f'),
    type: 'breast',
    start,
    side,
    ...(hold ? { hold } : {}),
    ...(holdCustom ? { holdCustom } : {}),
  };
  list.push(item);
  await saveFeedings(list);
  return item;
}

export async function endFeeding(id: string, end: string): Promise<void> {
  const list = await getFeedings();
  const idx = list.findIndex((f) => f.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], end };
    await saveFeedings(list);
  }
}

export async function addBottleFeeding(
  time: string,
  amount: number,
  unit: AmountUnit,
): Promise<FeedingSession> {
  const list = await getFeedings();
  const item: FeedingSession = {
    id: babyId('f'),
    type: 'bottle',
    start: time,
    end: time,
    amount,
    unit,
  };
  list.push(item);
  await saveFeedings(list);
  return item;
}

// Manual entry: log a complete breast-feeding session after the fact.
export async function addBreastFeedingComplete(
  start: string,
  end: string,
  side: FeedSide,
  hold?: FeedHold,
  holdCustom?: string,
): Promise<FeedingSession> {
  const list = await getFeedings();
  const item: FeedingSession = {
    id: babyId('f'),
    type: 'breast',
    start,
    end,
    side,
    ...(hold ? { hold } : {}),
    ...(holdCustom ? { holdCustom } : {}),
  };
  list.push(item);
  await saveFeedings(list);
  return item;
}

export async function deleteFeeding(id: string): Promise<void> {
  const list = await getFeedings();
  await saveFeedings(list.filter((f) => f.id !== id));
}

// Sleeps — mirrors the contraction pattern (start timer, then end).
export async function getSleeps(): Promise<SleepSession[]> {
  const json = await AsyncStorage.getItem(SLEEPS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveSleeps(list: SleepSession[]): Promise<void> {
  await AsyncStorage.setItem(SLEEPS_KEY, JSON.stringify(list));
}

export async function startSleep(start: string): Promise<SleepSession> {
  const list = await getSleeps();
  const item: SleepSession = { id: babyId('s'), start };
  list.push(item);
  await saveSleeps(list);
  return item;
}

export async function endSleep(id: string, end: string): Promise<void> {
  const list = await getSleeps();
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], end };
    await saveSleeps(list);
  }
}

// Manual entry: log a complete sleep session after the fact (covers overnight sleeps).
export async function addSleepComplete(start: string, end: string): Promise<SleepSession> {
  const list = await getSleeps();
  const item: SleepSession = { id: babyId('s'), start, end };
  list.push(item);
  await saveSleeps(list);
  return item;
}

export async function deleteSleep(id: string): Promise<void> {
  const list = await getSleeps();
  await saveSleeps(list.filter((x) => x.id !== id));
}

// Diapers — single-shot events. `addDiaper` already takes the timestamp, so manual
// backdating works by passing a past ISO string.
export async function getDiapers(): Promise<DiaperEvent[]> {
  const json = await AsyncStorage.getItem(DIAPERS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveDiapers(list: DiaperEvent[]): Promise<void> {
  await AsyncStorage.setItem(DIAPERS_KEY, JSON.stringify(list));
}

export async function addDiaper(kind: DiaperKind, time: string): Promise<DiaperEvent> {
  const list = await getDiapers();
  const item: DiaperEvent = { id: babyId('d'), kind, time };
  list.push(item);
  await saveDiapers(list);
  return item;
}

export async function deleteDiaper(id: string): Promise<void> {
  const list = await getDiapers();
  await saveDiapers(list.filter((x) => x.id !== id));
}
