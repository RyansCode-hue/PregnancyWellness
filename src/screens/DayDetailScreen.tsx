import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import SupplementCard from '../components/SupplementCard';
import WorkoutCard from '../components/WorkoutCard';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import {
  getSupplements,
  getDayRecord,
  toggleDose,
  saveDayRecord,
  saveDoseSourceRecord,
  deleteSupplement,
  getWorkouts,
  getWorkoutsForDate,
  getWorkoutDayRecord,
  saveWorkoutDayRecord,
  incrementWorkoutSessions,
  decrementWorkoutSessions,
  saveWorkoutNotes,
  deleteWorkout,
  formatDate,
  parseDate,
  getDisplayDayRecord,
  getDoseSourceRecord,
  getWeeklyWorkoutCounts,
  getLastCompletedWorkoutDates,
  getWorkoutSessions,
  computeWorkoutProgress,
  groupLinkedSupplements,
  saveSupplementOrder,
  saveWorkoutOrder,
  getSupplementClusterEdges,
  DAY_NAMES_FULL,
} from '../storage/storage';
import {
  getDosesFor,
  buildSupplementNameMap,
  getLinkedNames,
  reorderSupplementSections,
  reorderTodayWorkouts,
} from '../dayHelpers';
import { PillIcon, DumbbellIcon, BackIcon } from '../components/Icons';
import { RootStackParamList, Supplement, Workout, DayRecord, DoseSourceRecord, WorkoutDayRecord } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'DayDetail'>;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Snapshots are of the *stored* records for this date, never the display record:
// weekly supplements display doses merged across the week, and writing that back
// would copy other days' checks onto this day.
interface UndoState {
  type: 'supplement' | 'workout';
  id: string;
  name: string;
  previousSupRecord?: DayRecord;
  previousSourceRecord?: DoseSourceRecord;
  previousWorkoutRecord?: WorkoutDayRecord;
}

function reportError(context: string, err: unknown) {
  console.error(context, err);
  Alert.alert('Something went wrong', `${context}. Please try again.`);
}

export default function DayDetailScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [dayRecord, setDayRecord] = useState<DayRecord>({});
  const [doseSourceRecord, setDoseSourceRecord] = useState<DoseSourceRecord>({});
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutRecord, setWorkoutRecord] = useState<WorkoutDayRecord>({});
  const [weeklyWorkoutCounts, setWeeklyWorkoutCounts] = useState<Record<string, number>>({});
  const [lastCompletedDates, setLastCompletedDates] = useState<Record<string, string>>({});
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dose toggles are optimistic; their writes are serialized here so each undo
  // snapshot sees the result of the previous tap.
  const doseWriteQueue = useRef<Promise<void>>(Promise.resolve());

  const dateObj = parseDate(date);
  const todayStr = formatDate(new Date());
  const isToday = date === todayStr;
  const isFuture = date > todayStr;

  const dateDisplay = `${DAY_NAMES_FULL[dateObj.getDay()]}, ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getDate()}`;

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        if (undoTimer.current) clearTimeout(undoTimer.current);
      };
    }, [date])
  );

  const loadData = () =>
    loadDataInner().catch((err) => reportError('Could not load this day', err));

  const loadDataInner = async () => {
    const allSups = groupLinkedSupplements(await getSupplements());
    setSupplements(allSups);
    setDayRecord(await getDisplayDayRecord(date, allSups));
    setDoseSourceRecord(await getDoseSourceRecord(date));

    const allWorkouts = await getWorkouts();
    const todayWorkouts = getWorkoutsForDate(allWorkouts, date);
    setWorkouts(todayWorkouts);
    setWorkoutRecord(await getWorkoutDayRecord(date));

    const counts = await getWeeklyWorkoutCounts(todayWorkouts, date);
    setWeeklyWorkoutCounts(counts);
    setLastCompletedDates(await getLastCompletedWorkoutDates(Object.keys(counts)));
  };

  // ─── Undo system ───

  const showUndo = (state: UndoState) => {
    setUndoState(state);
    Animated.timing(undoOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => hideUndo(), 4000);
  };

  const hideUndo = () => {
    Animated.timing(undoOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setUndoState(null));
  };

  const handleUndo = async () => {
    if (!undoState) return;
    hideUndo();
    try {
      if (undoState.type === 'supplement' && undoState.previousSupRecord) {
        await saveDayRecord(date, undoState.previousSupRecord);
        await saveDoseSourceRecord(date, undoState.previousSourceRecord ?? {});
      }
      if (undoState.type === 'workout' && undoState.previousWorkoutRecord) {
        await saveWorkoutDayRecord(date, undoState.previousWorkoutRecord);
      }
    } catch (err) {
      reportError('Could not undo', err);
    }
    // Reload rather than restoring state: weekly merges and week counts depend on
    // other days, so the snapshot alone is not the right thing to display.
    await loadData();
  };

  // ─── Supplement handlers ───

  const handleToggleDose = (
    supplementId: string,
    doseIndex: number,
    dosesPerDay: number,
    supplementName: string,
  ) => {
    const tappedSup = supplements.find((s) => s.id === supplementId);
    const isWeekly = tappedSup?.frequency === 'weekly';

    // Optimistic local update — flip the dose immediately and mirror to linked supplements.
    // The new value is the negation of the currently-displayed value.
    const currentDoses = dayRecord[supplementId] || new Array(dosesPerDay).fill(false);
    const newValue = !currentDoses[doseIndex];

    const nextRecord: DayRecord = { ...dayRecord };
    const nextSources: DoseSourceRecord = { ...doseSourceRecord };

    const applyFlip = (sup: Supplement, mirroredValue: boolean) => {
      const arr = nextRecord[sup.id] ? [...nextRecord[sup.id]] : new Array(sup.dosesPerDay).fill(false);
      if (doseIndex < sup.dosesPerDay) {
        arr[doseIndex] = mirroredValue;
      }
      nextRecord[sup.id] = arr;

      const sArr = nextSources[sup.id] ? [...nextSources[sup.id]] : new Array(sup.dosesPerDay).fill(null);
      if (doseIndex < sup.dosesPerDay) {
        sArr[doseIndex] = mirroredValue ? supplementId : null;
      }
      nextSources[sup.id] = sArr;
    };

    if (tappedSup) {
      applyFlip(tappedSup, newValue);
      for (const linkedId of tappedSup.linkedSupplementIds || []) {
        const linked = supplements.find((s) => s.id === linkedId);
        if (linked) applyFlip(linked, newValue);
      }
    }

    setDayRecord(nextRecord);
    setDoseSourceRecord(nextSources);

    // Persist + reconcile in the background. Reconciling matters for weekly supplements
    // because their displayed checks are merged across all 7 days of the week —
    // the local flip might not reflect the merged truth (e.g. dose still checked on another day).
    doseWriteQueue.current = doseWriteQueue.current
      .then(async () => {
        const previousSupRecord = await getDayRecord(date);
        const previousSourceRecord = await getDoseSourceRecord(date);
        await toggleDose(date, supplementId, doseIndex, dosesPerDay);
        showUndo({
          type: 'supplement',
          id: supplementId,
          name: supplementName,
          previousSupRecord,
          previousSourceRecord,
        });
        if (isWeekly) await loadData();
      })
      .catch((err) => {
        reportError('Could not save that dose', err);
        // Drop the optimistic state so the screen shows what is actually stored.
        return loadData();
      });
  };

  const confirmDeleteSupplement = (supplement: Supplement) => {
    Alert.alert(
      'Delete Supplement',
      `Remove "${supplement.name}" from tracking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSupplement(supplement.id);
            loadData();
          },
        },
      ],
    );
  };

  // ─── Workout handlers ───

  const handleSaveWorkoutNotes = async (workoutId: string, notes: string) => {
    try {
      setWorkoutRecord(await saveWorkoutNotes(date, workoutId, notes));
    } catch (err) {
      reportError('Could not save notes', err);
    }
  };

  // Shared by increment/decrement: snapshot for undo, persist, then adjust the week
  // count by the actual stored delta (a decrement on a day with no sessions is a no-op).
  const changeWorkoutSessions = async (
    workout: Workout,
    change: (date: string, workoutId: string) => Promise<WorkoutDayRecord>,
  ) => {
    const previousWorkoutRecord: WorkoutDayRecord = {};
    for (const key of Object.keys(workoutRecord)) {
      previousWorkoutRecord[key] = { ...workoutRecord[key] };
    }
    const before = getWorkoutSessions(workoutRecord[workout.id]);
    try {
      const updated = await change(date, workout.id);
      setWorkoutRecord(updated);
      const delta = getWorkoutSessions(updated[workout.id]) - before;
      if (workout.frequency === 'weekly' && delta !== 0) {
        setWeeklyWorkoutCounts((prev) => ({
          ...prev,
          [workout.id]: Math.max(0, (prev[workout.id] ?? 0) + delta),
        }));
      }
    } catch (err) {
      reportError('Could not save that workout', err);
      return;
    }
    showUndo({
      type: 'workout',
      id: workout.id,
      name: workout.name,
      previousWorkoutRecord,
    });
  };

  const handleIncrementSession = (workout: Workout) =>
    changeWorkoutSessions(workout, incrementWorkoutSessions);

  const handleDecrementSession = (workout: Workout) =>
    changeWorkoutSessions(workout, decrementWorkoutSessions);

  const confirmDeleteWorkout = (workout: Workout) => {
    Alert.alert(
      'Delete Workout',
      `Remove "${workout.name}" from tracking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkout(workout.id);
            loadData();
          },
        },
      ],
    );
  };

  // ─── Split by frequency, grouped by linked clusters ───
  const dailySups = groupLinkedSupplements(supplements.filter((sup) => sup.frequency === 'daily'));
  const weeklySups = groupLinkedSupplements(supplements.filter((sup) => sup.frequency === 'weekly'));

  // ─── Arrow-button reorder ───
  // The persistence layer (saveSupplementOrder / saveWorkoutOrder) applies globally —
  // reordering on a DayDetail page also affects CalendarScreen.
  const handleMoveSupplement = async (
    supId: string,
    frequency: 'daily' | 'weekly',
    direction: 'up' | 'down',
  ) => {
    const newAll = reorderSupplementSections(dailySups, weeklySups, supId, frequency, direction);
    if (!newAll) return;
    setSupplements(newAll);
    try {
      await saveSupplementOrder(newAll.map((sp) => sp.id));
    } catch (err) {
      reportError('Could not save the new order', err);
    }
    loadData();
  };

  const handleMoveWorkout = async (workoutId: string, direction: 'up' | 'down') => {
    const result = reorderTodayWorkouts(workouts, await getWorkouts(), workoutId, direction);
    if (!result) return;
    setWorkouts(result.todayWorkouts);
    try {
      await saveWorkoutOrder(result.orderedIds);
    } catch (err) {
      reportError('Could not save the new order', err);
    }
    loadData();
  };

  // ─── Progress calc ───

  const getDoses = (supplement: Supplement) => getDosesFor(dayRecord, supplement);
  const supplementNameMap = buildSupplementNameMap(supplements);

  const completedDoses = supplements.reduce((acc, sup) => {
    return acc + getDoses(sup).filter(Boolean).length;
  }, 0);
  const totalDoses = supplements.reduce((acc, sup) => acc + sup.dosesPerDay, 0);

  const workoutProgress = computeWorkoutProgress(workouts, workoutRecord);
  const totalItems = totalDoses + workoutProgress.total;
  const completedItems = completedDoses + workoutProgress.completed;

  const hasContent = supplements.length > 0 || workouts.length > 0;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backButton}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <BackIcon size={20} color={colors.primary} strokeWidth={2.5} />
            <Text style={s.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <View style={s.dateContainer}>
          <Text style={s.dateText}>{dateDisplay}</Text>
          {isToday && (
            <View style={s.todayBadge}>
              <Text style={s.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>
        {totalItems > 0 && (
          <View style={s.progressContainer}>
            <View style={s.progressBar}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: totalItems > 0
                      ? `${Math.round((completedItems / totalItems) * 100)}%`
                      : '0%',
                  },
                  completedItems === totalItems && s.progressComplete,
                ]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      {!hasContent ? (
        <View style={s.emptyState}>
          <PillIcon size={64} color={colors.checkboxEmpty} strokeWidth={1.5} />
          <Text style={s.emptyTitle}>Nothing scheduled</Text>
          <Text style={s.emptySubtitle}>
            Go back and add supplements or workouts to get started
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isFuture && (
            <View style={s.futureBanner}>
              <Text style={s.futureBannerText}>Future date — view only</Text>
            </View>
          )}

          {dailySups.length > 0 && (
            <>
              <View style={s.sectionHeaderRow}>
                <PillIcon size={16} color={colors.primary} strokeWidth={2} />
                <Text style={s.sectionHeader}>Daily</Text>
              </View>
              {dailySups.map((sup) => {
                const edges = getSupplementClusterEdges(dailySups, sup.id);
                return (
                  <SupplementCard
                    key={sup.id}
                    supplement={sup}
                    doses={getDoses(sup)}
                    onToggleDose={(doseIndex) =>
                      handleToggleDose(sup.id, doseIndex, sup.dosesPerDay, sup.name)
                    }
                    onEdit={() =>
                      navigation.navigate('AddEditSupplement', { supplement: sup })
                    }
                    onDelete={() => confirmDeleteSupplement(sup)}
                    disabled={isFuture}
                    colors={colors}
                    linkedNames={getLinkedNames(sup, supplementNameMap)}
                    doseSources={doseSourceRecord[sup.id]}
                    supplementNames={supplementNameMap}
                    onMoveUp={
                      isFuture ? undefined : () => handleMoveSupplement(sup.id, 'daily', 'up')
                    }
                    onMoveDown={
                      isFuture ? undefined : () => handleMoveSupplement(sup.id, 'daily', 'down')
                    }
                    canMoveUp={!edges.isFirst}
                    canMoveDown={!edges.isLast}
                  />
                );
              })}
            </>
          )}

          {weeklySups.length > 0 && (
            <>
              <View
                style={[
                  s.sectionHeaderRow,
                  dailySups.length > 0 && { marginTop: spacing.md },
                ]}
              >
                <PillIcon size={16} color="#B45309" strokeWidth={2} />
                <Text style={[s.sectionHeader, { color: '#B45309' }]}>Weekly</Text>
              </View>
              {weeklySups.map((sup) => {
                const edges = getSupplementClusterEdges(weeklySups, sup.id);
                return (
                  <SupplementCard
                    key={sup.id}
                    supplement={sup}
                    doses={getDoses(sup)}
                    onToggleDose={(doseIndex) =>
                      handleToggleDose(sup.id, doseIndex, sup.dosesPerDay, sup.name)
                    }
                    onEdit={() =>
                      navigation.navigate('AddEditSupplement', { supplement: sup })
                    }
                    onDelete={() => confirmDeleteSupplement(sup)}
                    disabled={isFuture}
                    colors={colors}
                    linkedNames={getLinkedNames(sup, supplementNameMap)}
                    doseSources={doseSourceRecord[sup.id]}
                    supplementNames={supplementNameMap}
                    onMoveUp={
                      isFuture ? undefined : () => handleMoveSupplement(sup.id, 'weekly', 'up')
                    }
                    onMoveDown={
                      isFuture ? undefined : () => handleMoveSupplement(sup.id, 'weekly', 'down')
                    }
                    canMoveUp={!edges.isFirst}
                    canMoveDown={!edges.isLast}
                  />
                );
              })}
            </>
          )}

          {workouts.length > 0 && (
            <>
              <View
                style={[
                  s.sectionHeaderRow,
                  supplements.length > 0 && { marginTop: spacing.lg },
                ]}
              >
                <DumbbellIcon size={16} color={colors.textSubtle} strokeWidth={2} />
                <Text style={s.sectionHeader}>Workouts</Text>
              </View>
              {workouts.map((workout, idx) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  record={workoutRecord[workout.id]}
                  onSaveNotes={(notes) => handleSaveWorkoutNotes(workout.id, notes)}
                  onEdit={() => navigation.navigate('AddEditWorkout', { workout })}
                  onDelete={() => confirmDeleteWorkout(workout)}
                  disabled={isFuture}
                  colors={colors}
                  weekCount={
                    workout.frequency === 'weekly'
                      ? weeklyWorkoutCounts[workout.id] ?? 0
                      : undefined
                  }
                  onIncrementSession={() => handleIncrementSession(workout)}
                  onDecrementSession={() => handleDecrementSession(workout)}
                  lastCompletedDate={lastCompletedDates[workout.id]}
                  onMoveUp={
                    isFuture ? undefined : () => handleMoveWorkout(workout.id, 'up')
                  }
                  onMoveDown={
                    isFuture ? undefined : () => handleMoveWorkout(workout.id, 'down')
                  }
                  canMoveUp={idx > 0}
                  canMoveDown={idx < workouts.length - 1}
                />
              ))}
            </>
          )}

          <Text style={s.hint}>
            {isFuture
              ? 'Swipe any item left to edit or delete'
              : 'Use ▲ ▼ to reorder · Swipe left to edit or delete'}
          </Text>
        </ScrollView>
      )}

      {/* Undo Toast */}
      {undoState && (
        <Animated.View style={[s.undoToast, { opacity: undoOpacity }]}>
          <Text style={s.undoText}>
            Updated {undoState.name}
          </Text>
          <TouchableOpacity onPress={handleUndo} style={s.undoButton}>
            <Text style={s.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 32 : 0,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.card,
      borderBottomLeftRadius: borderRadius.lg,
      borderBottomRightRadius: borderRadius.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    backButton: {
      marginBottom: spacing.sm,
    },
    backText: {
      fontSize: fontSize.lg,
      color: colors.primary,
      fontWeight: '600',
    },
    dateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dateText: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
    },
    todayBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    todayBadgeText: {
      color: colors.primary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    progressContainer: {
      marginTop: spacing.sm,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
    },
    progressComplete: {
      backgroundColor: colors.success,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xl * 3,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    sectionHeader: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.textSubtle,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    emptyTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    futureBanner: {
      backgroundColor: colors.border,
      padding: spacing.sm,
      borderRadius: borderRadius.sm,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    futureBannerText: {
      color: colors.textSubtle,
      fontSize: fontSize.sm,
    },
    hint: {
      textAlign: 'center',
      color: colors.checkboxEmpty,
      fontSize: fontSize.sm,
      marginTop: spacing.md,
    },
    undoToast: {
      position: 'absolute',
      bottom: spacing.xl + spacing.lg,
      left: spacing.lg,
      right: spacing.lg,
      backgroundColor: colors.text,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
    undoText: {
      color: colors.background,
      fontSize: fontSize.md,
      fontWeight: '500',
      flex: 1,
    },
    undoButton: {
      marginLeft: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    undoButtonText: {
      color: '#FFFFFF',
      fontSize: fontSize.md,
      fontWeight: '700',
    },
  });
}
