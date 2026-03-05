import AsyncStorage from '@react-native-async-storage/async-storage';
import { Supplement, DayRecord, DoseSourceRecord, Workout, WorkoutDayRecord, AppSettings, DEFAULT_SETTINGS } from '../types';

const SUPPLEMENTS_KEY = 'supplements';
const WORKOUTS_KEY = 'workouts';
const SETTINGS_KEY = 'app_settings';
const DAY_PREFIX = 'day:';
const WORKOUT_DAY_PREFIX = 'workout_day:';
const DOSE_SOURCE_PREFIX = 'dose_source:';
const INSTALL_DATE_KEY = 'app_install_date';

// ─── Settings ───

export async function getSettings(): Promise<AppSettings> {
  const json = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!json) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Supplements CRUD ───

export async function getSupplements(): Promise<Supplement[]> {
  const json = await AsyncStorage.getItem(SUPPLEMENTS_KEY);
  if (!json) return [];
  const supplements: Supplement[] = JSON.parse(json);
  return supplements.map((s) => ({
    ...s,
    frequency: s.frequency || 'daily',
    linkedSupplementIds: s.linkedSupplementIds || [],
  }));
}

export async function saveSupplement(supplement: Supplement): Promise<void> {
  const supplements = await getSupplements();
  const index = supplements.findIndex((s) => s.id === supplement.id);
  const oldLinked = index >= 0 ? (supplements[index].linkedSupplementIds || []) : [];
  const newLinked = supplement.linkedSupplementIds || [];

  if (index >= 0) {
    supplements[index] = supplement;
  } else {
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

// ─── Supplement filtering for a given date ───

export function getSupplementsForDate(
  supplements: Supplement[],
  _dateStr: string,
): Supplement[] {
  // All supplements (daily + weekly) show every day.
  // Weekly ones can be taken any day during the week.
  return supplements;
}

// Get the Monday..Sunday range containing the given date
export function getWeekRange(dateStr: string): { start: string; end: string } {
  const date = parseDate(dateStr);
  const day = date.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

// Check how many weekly supplement doses are completed this week
export async function getWeeklyProgress(
  supplements: Supplement[],
  dateStr: string,
): Promise<{ completed: number; total: number }> {
  const weeklySups = supplements.filter((s) => s.frequency === 'weekly');
  if (weeklySups.length === 0) return { completed: 0, total: 0 };

  const { start } = getWeekRange(dateStr);
  const startDate = parseDate(start);
  let totalDoses = 0;
  let completedDoses = 0;

  for (const sup of weeklySups) {
    totalDoses += sup.dosesPerDay;
    let supCompleted = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const ds = formatDate(d);
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
  return JSON.parse(json);
}

export async function saveWorkout(workout: Workout): Promise<void> {
  const workouts = await getWorkouts();
  const index = workouts.findIndex((w) => w.id === workout.id);
  if (index >= 0) {
    workouts[index] = workout;
  } else {
    workouts.push(workout);
  }
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
}

export async function deleteWorkout(id: string): Promise<void> {
  const workouts = await getWorkouts();
  const filtered = workouts.filter((w) => w.id !== id);
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(filtered));
}

// ─── Workout progress ───

export async function getWorkoutProgress(
  workouts: Workout[],
  dateStr: string,
): Promise<{ completed: number; total: number }> {
  const todayWorkouts = getWorkoutsForDate(workouts, dateStr);
  if (todayWorkouts.length === 0) return { completed: 0, total: 0 };

  const record = await getWorkoutDayRecord(dateStr);
  let completed = 0;
  for (const w of todayWorkouts) {
    if (record[w.id]?.completed) completed++;
  }
  return { completed, total: todayWorkouts.length };
}

// ─── Workout filtering for a given date ───

export function getWorkoutsForDate(
  workouts: Workout[],
  dateStr: string,
): Workout[] {
  const date = parseDate(dateStr);
  const dayOfWeek = date.getDay();
  return workouts.filter((w) => w.assignedDays.includes(dayOfWeek as any));
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

export async function toggleWorkout(
  date: string,
  workoutId: string,
): Promise<WorkoutDayRecord> {
  const record = await getWorkoutDayRecord(date);
  if (!record[workoutId]) {
    record[workoutId] = { completed: true };
  } else {
    record[workoutId] = {
      ...record[workoutId],
      completed: !record[workoutId].completed,
    };
  }
  await saveWorkoutDayRecord(date, record);
  return record;
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

  // Workout status
  const relevantWorkouts = getWorkoutsForDate(workouts, date);
  let workoutStatus: DayStatusType = 'none';
  if (relevantWorkouts.length > 0) {
    const workoutRecord = await getWorkoutDayRecord(date);
    let allComplete = true;
    for (const workout of relevantWorkouts) {
      if (!workoutRecord[workout.id]?.completed) {
        allComplete = false;
        break;
      }
    }
    workoutStatus = allComplete ? 'complete' : 'incomplete';
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

export function getPregnancyWeek(dueDate: string): { week: number; day: number } | null {
  if (!dueDate) return null;
  const due = parseDate(dueDate);
  const now = new Date();

  const lmpMs = due.getTime() - 280 * 24 * 60 * 60 * 1000;
  const elapsed = now.getTime() - lmpMs;
  const totalDays = Math.floor(elapsed / (24 * 60 * 60 * 1000));

  if (totalDays < 0 || totalDays > 300) return null;

  const week = Math.floor(totalDays / 7);
  const day = totalDays % 7;
  return { week, day };
}

export function getDaysUntilDue(dueDate: string): number | null {
  if (!dueDate) return null;
  const due = parseDate(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
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

  const { start } = getWeekRange(dateStr);
  const startDate = parseDate(start);
  const merged: DayRecord = {};

  // Initialize merged record with false arrays
  for (const sup of weeklySups) {
    merged[sup.id] = new Array(sup.dosesPerDay).fill(false);
  }

  // Scan all 7 days and merge checked doses
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const ds = formatDate(d);
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

  // Build linked clusters using connected components (same algorithm as groupLinkedSupplements)
  const visited = new Set<string>();
  const clusters: Supplement[][] = [];
  const supById = new Map<string, Supplement>();
  for (const s of supplements) supById.set(s.id, s);

  for (const sup of supplements) {
    if (visited.has(sup.id)) continue;
    const cluster: Supplement[] = [];
    const queue = [sup.id];
    visited.add(sup.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const current = supById.get(id);
      if (current) {
        cluster.push(current);
        for (const linkedId of current.linkedSupplementIds || []) {
          if (!visited.has(linkedId) && supById.has(linkedId)) {
            visited.add(linkedId);
            queue.push(linkedId);
          }
        }
      }
    }
    clusters.push(cluster);
  }

  // Process each cluster
  for (const cluster of clusters) {
    // All supplements in a cluster share the same frequency
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

  // Workouts: for each workout, count how many assigned days were completed
  const workoutItems: WeeklyReportWorkoutItem[] = [];
  for (const workout of workouts) {
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
        if (record[workout.id]?.completed) {
          completedDays++;
        }
      }
    }
    if (totalDays > 0) {
      workoutItems.push({ name: workout.name, completedDays, totalDays });
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
  const install = parseDate(installDate);
  const today = new Date();

  // Find the Monday of install week
  const installDay = install.getDay();
  const installMondayOffset = installDay === 0 ? -6 : 1 - installDay;
  const firstMonday = new Date(install);
  firstMonday.setDate(install.getDate() + installMondayOffset);

  // Find Monday of current week
  const todayDay = today.getDay();
  const todayMondayOffset = todayDay === 0 ? -6 : 1 - todayDay;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + todayMondayOffset);

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

// ─── Linked supplement grouping ───
// Groups linked supplements so they appear adjacent in lists.
// Uses connected-component discovery: if A links B and B links C, all three are grouped together.
export function groupLinkedSupplements(supplements: Supplement[]): Supplement[] {
  if (supplements.length <= 1) return supplements;

  const visited = new Set<string>();
  const result: Supplement[] = [];
  const idToSup = new Map<string, Supplement>();
  for (const sup of supplements) {
    idToSup.set(sup.id, sup);
  }

  for (const sup of supplements) {
    if (visited.has(sup.id)) continue;

    // BFS to find the full connected component
    const cluster: Supplement[] = [];
    const queue: string[] = [sup.id];
    visited.add(sup.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = idToSup.get(currentId);
      if (current) {
        cluster.push(current);
        for (const linkedId of current.linkedSupplementIds || []) {
          if (!visited.has(linkedId) && idToSup.has(linkedId)) {
            visited.add(linkedId);
            queue.push(linkedId);
          }
        }
      }
    }

    result.push(...cluster);
  }

  return result;
}
