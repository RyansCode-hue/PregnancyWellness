import React, { useState, useCallback, useRef } from 'react';
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
  deleteSupplement,
  getWorkouts,
  getWorkoutsForDate,
  getWorkoutDayRecord,
  toggleWorkout,
  saveWorkoutNotes,
  deleteWorkout,
  formatDate,
  parseDate,
  getSupplementsForDate,
  getWeeklySupplementDoses,
  getDoseSourceRecord,
  getWeeklyWorkoutCount,
  groupLinkedSupplements,
  DAY_NAMES_FULL,
} from '../storage/storage';
import { PillIcon, DumbbellIcon, BackIcon } from '../components/Icons';
import { RootStackParamList, Supplement, Workout, DayRecord, DoseSourceRecord, WorkoutDayRecord } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'DayDetail'>;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface UndoState {
  type: 'supplement' | 'workout';
  id: string;
  name: string;
  previousSupRecord?: DayRecord;
  previousWorkoutRecord?: WorkoutDayRecord;
}

export default function DayDetailScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [dayRecord, setDayRecord] = useState<DayRecord>({});
  const [doseSourceRecord, setDoseSourceRecord] = useState<DoseSourceRecord>({});
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutRecord, setWorkoutRecord] = useState<WorkoutDayRecord>({});
  const [weeklyWorkoutCounts, setWeeklyWorkoutCounts] = useState<Record<string, number>>({});
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadData = async () => {
    const allSups = await getSupplements();
    const filteredSups = groupLinkedSupplements(getSupplementsForDate(allSups, date));
    setSupplements(filteredSups);

    // Get the day's own record for daily supplements
    const record = await getDayRecord(date);

    // Merge weekly supplement doses from across the entire week
    const weeklyDoses = await getWeeklySupplementDoses(date, filteredSups);
    const mergedRecord: DayRecord = { ...record };
    for (const supId of Object.keys(weeklyDoses)) {
      mergedRecord[supId] = weeklyDoses[supId];
    }
    setDayRecord(mergedRecord);

    // Load dose source record for attribution display
    setDoseSourceRecord(await getDoseSourceRecord(date));

    const allWorkouts = await getWorkouts();
    const todayWorkouts = getWorkoutsForDate(allWorkouts, date);
    setWorkouts(todayWorkouts);
    setWorkoutRecord(await getWorkoutDayRecord(date));

    // Weekly counts only matter for goal-frequency workouts
    const counts: Record<string, number> = {};
    for (const w of todayWorkouts) {
      if (w.frequency === 'weekly') {
        counts[w.id] = await getWeeklyWorkoutCount(w.id, date);
      }
    }
    setWeeklyWorkoutCounts(counts);
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
    if (undoState.type === 'supplement' && undoState.previousSupRecord) {
      await saveDayRecord(date, undoState.previousSupRecord);
      setDayRecord(undoState.previousSupRecord);
    }
    if (undoState.type === 'workout' && undoState.previousWorkoutRecord) {
      const { saveWorkoutDayRecord } = require('../storage/storage');
      await saveWorkoutDayRecord(date, undoState.previousWorkoutRecord);
      setWorkoutRecord(undoState.previousWorkoutRecord);
    }
    hideUndo();
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

    // Snapshot for undo (deep copy of dayRecord)
    const previousSupRecord: DayRecord = {};
    for (const key of Object.keys(dayRecord)) {
      previousSupRecord[key] = [...dayRecord[key]];
    }

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
    void (async () => {
      await toggleDose(date, supplementId, doseIndex, dosesPerDay);
      if (isWeekly) await loadData();
    })();

    showUndo({
      type: 'supplement',
      id: supplementId,
      name: supplementName,
      previousSupRecord,
    });
  };

  const handleSupplementLongPress = (supplement: Supplement) => {
    Alert.alert(supplement.name, 'What would you like to do?', [
      { text: 'Edit', onPress: () => navigation.navigate('AddEditSupplement', { supplement }) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteSupplement(supplement) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  const handleToggleWorkout = async (workoutId: string, workoutName: string) => {
    const previousWorkoutRecord: WorkoutDayRecord = {};
    for (const key of Object.keys(workoutRecord)) {
      previousWorkoutRecord[key] = { ...workoutRecord[key] };
    }

    const wasCompleted = !!workoutRecord[workoutId]?.completed;
    const updated = await toggleWorkout(date, workoutId);
    setWorkoutRecord(updated);

    // Keep the displayed week count in sync for goal workouts.
    const w = workouts.find((x) => x.id === workoutId);
    if (w?.frequency === 'weekly') {
      setWeeklyWorkoutCounts((prev) => ({
        ...prev,
        [workoutId]: Math.max(0, (prev[workoutId] ?? 0) + (wasCompleted ? -1 : 1)),
      }));
    }

    showUndo({
      type: 'workout',
      id: workoutId,
      name: workoutName,
      previousWorkoutRecord,
    });
  };

  const handleSaveWorkoutNotes = async (workoutId: string, notes: string) => {
    const updated = await saveWorkoutNotes(date, workoutId, notes);
    setWorkoutRecord(updated);
  };

  const handleWorkoutLongPress = (workout: Workout) => {
    Alert.alert(workout.name, 'What would you like to do?', [
      { text: 'Edit', onPress: () => navigation.navigate('AddEditWorkout', { workout }) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteWorkout(workout) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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

  // ─── Progress calc ───

  const getDoses = (supplement: Supplement): boolean[] => {
    return dayRecord[supplement.id] || new Array(supplement.dosesPerDay).fill(false);
  };

  // Build supplement name map for dose source labels
  const supplementNameMap: Record<string, string> = {};
  for (const sup of supplements) {
    supplementNameMap[sup.id] = sup.name;
  }

  const getLinkedNames = (sup: Supplement): string[] => {
    if (!sup.linkedSupplementIds || sup.linkedSupplementIds.length === 0) return [];
    return sup.linkedSupplementIds
      .map((id) => supplementNameMap[id])
      .filter(Boolean);
  };

  const completedDoses = supplements.reduce((acc, sup) => {
    return acc + getDoses(sup).filter(Boolean).length;
  }, 0);
  const totalDoses = supplements.reduce((acc, sup) => acc + sup.dosesPerDay, 0);

  const completedWorkouts = workouts.filter((w) => workoutRecord[w.id]?.completed).length;
  const totalItems = totalDoses + workouts.length;
  const completedItems = completedDoses + completedWorkouts;

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
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!hasContent ? (
          <View style={s.emptyState}>
            <PillIcon size={64} color={colors.checkboxEmpty} strokeWidth={1.5} />
            <Text style={s.emptyTitle}>Nothing scheduled</Text>
            <Text style={s.emptySubtitle}>
              Go back and add supplements or workouts to get started
            </Text>
          </View>
        ) : (
          <>
            {isFuture && (
              <View style={s.futureBanner}>
                <Text style={s.futureBannerText}>
                  Future date — view only
                </Text>
              </View>
            )}

            {/* Daily Supplements Section */}
            {dailySups.length > 0 && (
              <>
                <View style={s.sectionHeaderRow}>
                  <PillIcon size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={s.sectionHeader}>Daily</Text>
                </View>
                {dailySups.map((sup) => (
                  <SupplementCard
                    key={sup.id}
                    supplement={sup}
                    doses={getDoses(sup)}
                    onToggleDose={(doseIndex) =>
                      handleToggleDose(sup.id, doseIndex, sup.dosesPerDay, sup.name)
                    }
                    onLongPress={() => handleSupplementLongPress(sup)}
                    disabled={isFuture}
                    colors={colors}
                    linkedNames={getLinkedNames(sup)}
                    doseSources={doseSourceRecord[sup.id]}
                    supplementNames={supplementNameMap}
                  />
                ))}
              </>
            )}

            {/* Weekly Supplements Section */}
            {weeklySups.length > 0 && (
              <>
                <View style={[s.sectionHeaderRow, dailySups.length > 0 && { marginTop: spacing.md }]}>
                  <PillIcon size={16} color="#B45309" strokeWidth={2} />
                  <Text style={[s.sectionHeader, { color: '#B45309' }]}>Weekly</Text>
                </View>
                {weeklySups.map((sup) => (
                  <SupplementCard
                    key={sup.id}
                    supplement={sup}
                    doses={getDoses(sup)}
                    onToggleDose={(doseIndex) =>
                      handleToggleDose(sup.id, doseIndex, sup.dosesPerDay, sup.name)
                    }
                    onLongPress={() => handleSupplementLongPress(sup)}
                    disabled={isFuture}
                    colors={colors}
                    linkedNames={getLinkedNames(sup)}
                    doseSources={doseSourceRecord[sup.id]}
                    supplementNames={supplementNameMap}
                  />
                ))}
              </>
            )}

            {/* Workouts Section */}
            {workouts.length > 0 && (
              <>
                <View style={[s.sectionHeaderRow, supplements.length > 0 && { marginTop: spacing.lg }]}>
                  <DumbbellIcon size={16} color={colors.textSubtle} strokeWidth={2} />
                  <Text style={s.sectionHeader}>Workouts</Text>
                </View>
                {workouts.map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    workout={workout}
                    record={workoutRecord[workout.id]}
                    onToggle={() => handleToggleWorkout(workout.id, workout.name)}
                    onSaveNotes={(notes) => handleSaveWorkoutNotes(workout.id, notes)}
                    onLongPress={() => handleWorkoutLongPress(workout)}
                    disabled={isFuture}
                    colors={colors}
                    weekCount={
                      workout.frequency === 'weekly'
                        ? weeklyWorkoutCounts[workout.id] ?? 0
                        : undefined
                    }
                  />
                ))}
              </>
            )}

            <Text style={s.hint}>Long-press any item to edit or delete</Text>
          </>
        )}
      </ScrollView>

      {/* Undo Toast */}
      {undoState && (
        <Animated.View style={[s.undoToast, { opacity: undoOpacity }]}>
          <Text style={s.undoText}>
            Toggled {undoState.name}
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
    scrollView: {
      flex: 1,
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
    emptyIcon: {
      marginBottom: spacing.md,
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
