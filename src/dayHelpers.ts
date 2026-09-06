import { Supplement, Workout, DayRecord } from './types';
import { moveSupplementClusterInSection, moveWorkoutInList } from './storage/storage';

// Pure helpers shared by the screens that render a day's supplements and workouts
// (CalendarScreen's "today" panel and DayDetailScreen).

export function getDosesFor(record: DayRecord, supplement: Supplement): boolean[] {
  return record[supplement.id] || new Array(supplement.dosesPerDay).fill(false);
}

export function buildSupplementNameMap(supplements: Supplement[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const sup of supplements) map[sup.id] = sup.name;
  return map;
}

export function getLinkedNames(
  supplement: Supplement,
  nameMap: Record<string, string>,
): string[] {
  return (supplement.linkedSupplementIds || [])
    .map((id) => nameMap[id])
    .filter(Boolean);
}

// Move the cluster containing `supId` within its frequency section and return the
// full list in persistence order (weekly section first, then daily — the order
// both screens display). Returns null when the cluster is already at the edge.
export function reorderSupplementSections(
  dailySups: Supplement[],
  weeklySups: Supplement[],
  supId: string,
  frequency: Supplement['frequency'],
  direction: 'up' | 'down',
): Supplement[] | null {
  const section = frequency === 'daily' ? dailySups : weeklySups;
  const reordered = moveSupplementClusterInSection(section, supId, direction);
  if (reordered === section) return null;
  return frequency === 'daily' ? [...weeklySups, ...reordered] : [...reordered, ...dailySups];
}

// Swap `workoutId` with its neighbour among the workouts shown today and return the
// id ordering to persist: today's workouts first, then every other workout in its
// existing order. Returns null when already at the edge.
export function reorderTodayWorkouts(
  todayWorkouts: Workout[],
  allWorkouts: Workout[],
  workoutId: string,
  direction: 'up' | 'down',
): { todayWorkouts: Workout[]; orderedIds: string[] } | null {
  const reordered = moveWorkoutInList(todayWorkouts, workoutId, direction);
  if (reordered === todayWorkouts) return null;
  const todayIds = reordered.map((w) => w.id);
  const todaySet = new Set(todayIds);
  const others = allWorkouts.filter((w) => !todaySet.has(w.id)).map((w) => w.id);
  return { todayWorkouts: reordered, orderedIds: [...todayIds, ...others] };
}
