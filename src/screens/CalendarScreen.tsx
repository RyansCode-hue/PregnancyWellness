import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CalendarGrid from '../components/CalendarGrid';
import SupplementCard from '../components/SupplementCard';
import WorkoutCard from '../components/WorkoutCard';
import { PillIcon, DumbbellIcon } from '../components/Icons';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import {
  getSupplements,
  getWorkouts,
  getMonthStatuses,
  getPregnancyWeek,
  getDaysUntilDue,
  getDailyProgress,
  getWeeklyProgress,
  getWorkoutsForDate,
  getWorkoutDayRecord,
  toggleDose,
  incrementWorkoutSessions,
  decrementWorkoutSessions,
  saveWorkoutNotes,
  deleteSupplement,
  deleteWorkout,
  getWeeklyWorkoutCounts,
  getLastCompletedWorkoutDates,
  formatDate,
  getDisplayDayRecord,
  getWorkoutProgress,
  getDoseSourceRecord,
  groupLinkedSupplements,
  saveSupplementOrder,
  saveWorkoutOrder,
  getSupplementClusterEdges,
  DayCombinedStatus,
} from '../storage/storage';
import {
  getDosesFor,
  buildSupplementNameMap,
  getLinkedNames,
  reorderSupplementSections,
  reorderTodayWorkouts,
} from '../dayHelpers';
import { RootStackParamList, Supplement, Workout, DayRecord, DoseSourceRecord, WorkoutDayRecord } from '../types';

function reportError(context: string, err: unknown) {
  console.error(context, err);
  Alert.alert('Something went wrong', `${context}. Please try again.`);
}

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

export default function CalendarScreen({ navigation }: Props) {
  const { colors, isDark, settings } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const today = new Date();
  const todayStr = formatDate(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [statuses, setStatuses] = useState<Record<string, DayCombinedStatus>>({});
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [workoutsList, setWorkoutsList] = useState<Workout[]>([]);

  // Today's data
  const [dailyProgress, setDailyProgress] = useState({ completed: 0, total: 0 });
  const [weeklyProgress, setWeeklyProgress] = useState({ completed: 0, total: 0 });
  const [workoutProgress, setWorkoutProgress] = useState({ completed: 0, total: 0 });
  const [dayRecord, setDayRecord] = useState<DayRecord>({});
  const [doseSourceRecord, setDoseSourceRecord] = useState<DoseSourceRecord>({});
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [workoutRecord, setWorkoutRecord] = useState<WorkoutDayRecord>({});
  const [weeklyWorkoutCounts, setWeeklyWorkoutCounts] = useState<Record<string, number>>({});
  const [lastCompletedDates, setLastCompletedDates] = useState<Record<string, string>>({});
  const [showToday, setShowToday] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [year, month])
  );

  const loadData = () =>
    loadDataInner().catch((err) => reportError('Could not load the calendar', err));

  const loadDataInner = async () => {
    const sups = await getSupplements();
    setSupplements(sups);
    const wks = await getWorkouts();
    setWorkoutsList(wks);
    const monthStatuses = await getMonthStatuses(year, month, sups, wks);
    setStatuses(monthStatuses);

    // Today's progress
    const dp = await getDailyProgress(sups, todayStr);
    setDailyProgress(dp);
    const wp = await getWeeklyProgress(sups, todayStr);
    setWeeklyProgress(wp);
    const wkp = await getWorkoutProgress(wks, todayStr);
    setWorkoutProgress(wkp);

    // Today's records for inline view (weekly supplement doses merged across the week)
    setDayRecord(await getDisplayDayRecord(todayStr, sups));
    setDoseSourceRecord(await getDoseSourceRecord(todayStr));
    const tw = getWorkoutsForDate(wks, todayStr);
    setTodayWorkouts(tw);
    setWorkoutRecord(await getWorkoutDayRecord(todayStr));

    const counts = await getWeeklyWorkoutCounts(tw, todayStr);
    setWeeklyWorkoutCounts(counts);
    setLastCompletedDates(await getLastCompletedWorkoutDates(Object.keys(counts)));
  };

  const handlePrevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else { setMonth(month - 1); }
  };

  const handleNextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else { setMonth(month + 1); }
  };

  const handleDayPress = (date: string) => {
    navigation.navigate('DayDetail', { date });
  };

  // Each write is followed by a full reload so the month grid, progress bars and
  // week counts all reflect the stored state.
  const persistThenReload = async (context: string, write: () => Promise<unknown>) => {
    try {
      await write();
    } catch (err) {
      reportError(context, err);
    }
    loadData();
  };

  const handleToggleDose = (supId: string, doseIndex: number, dosesPerDay: number) =>
    persistThenReload('Could not save that dose', async () => {
      setDayRecord(await toggleDose(todayStr, supId, doseIndex, dosesPerDay));
    });

  const handleSaveWorkoutNotes = async (workoutId: string, notes: string) => {
    try {
      setWorkoutRecord(await saveWorkoutNotes(todayStr, workoutId, notes));
    } catch (err) {
      reportError('Could not save notes', err);
    }
  };

  const handleIncrementSession = (workoutId: string) =>
    persistThenReload('Could not save that workout', async () => {
      setWorkoutRecord(await incrementWorkoutSessions(todayStr, workoutId));
    });

  const handleDecrementSession = (workoutId: string) =>
    persistThenReload('Could not save that workout', async () => {
      setWorkoutRecord(await decrementWorkoutSessions(todayStr, workoutId));
    });

  const confirmDeleteSupplement = (sup: Supplement) => {
    Alert.alert(
      'Delete Supplement',
      `Remove "${sup.name}" from tracking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSupplement(sup.id);
            loadData();
          },
        },
      ],
    );
  };

  const confirmDeleteWorkout = (w: Workout) => {
    Alert.alert(
      'Delete Workout',
      `Remove "${w.name}" from tracking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkout(w.id);
            loadData();
          },
        },
      ],
    );
  };

  // Pregnancy info
  const pregnancyWeek = settings.dueDate ? getPregnancyWeek(settings.dueDate) : null;
  const daysUntil = settings.dueDate ? getDaysUntilDue(settings.dueDate) : null;

  // Sort supplements: weekly first, then daily — grouped by linked clusters
  const weeklySups = groupLinkedSupplements(supplements.filter((sup) => sup.frequency === 'weekly'));
  const dailySups = groupLinkedSupplements(supplements.filter((sup) => sup.frequency === 'daily'));

  // ─── Arrow-button reorder ───
  // Linked supplements move together as a cluster; the merged full ordering is
  // persisted so DayDetailScreen shows the same order.
  const handleMoveSupplement = (
    supId: string,
    frequency: 'daily' | 'weekly',
    direction: 'up' | 'down',
  ) => {
    const newAll = reorderSupplementSections(dailySups, weeklySups, supId, frequency, direction);
    if (!newAll) return;
    setSupplements(newAll);
    return persistThenReload('Could not save the new order', () =>
      saveSupplementOrder(newAll.map((sp) => sp.id)),
    );
  };

  const handleMoveWorkout = (workoutId: string, direction: 'up' | 'down') => {
    const result = reorderTodayWorkouts(todayWorkouts, workoutsList, workoutId, direction);
    if (!result) return;
    setTodayWorkouts(result.todayWorkouts);
    return persistThenReload('Could not save the new order', () =>
      saveWorkoutOrder(result.orderedIds),
    );
  };

  const getDoses = (sup: Supplement) => getDosesFor(dayRecord, sup);
  const supplementNameMap = buildSupplementNameMap(supplements);

  const hasAnything = supplements.length > 0 || todayWorkouts.length > 0;

  return (
    <View style={s.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView contentContainerStyle={s.scrollContent}>
        {/* Pregnancy Week Banner */}
        {pregnancyWeek && (
          <View style={s.pregnancyBanner}>
            <View style={s.pregnancyWeekCircle}>
              <Text style={s.pregnancyWeekNumber}>{pregnancyWeek.week}</Text>
              <Text style={s.pregnancyWeekLabel}>weeks</Text>
            </View>
            <View style={s.pregnancyInfo}>
              <Text style={s.pregnancyTitle}>
                Week {pregnancyWeek.week}, Day {pregnancyWeek.day}
              </Text>
              {daysUntil !== null && daysUntil > 0 ? (
                <Text style={s.pregnancySubtitle}>
                  {daysUntil} days until due date
                </Text>
              ) : daysUntil !== null && daysUntil <= 0 ? (
                <Text style={s.pregnancySubtitle}>Due date reached!</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Progress Bars above calendar */}
        {(dailyProgress.total > 0 || weeklyProgress.total > 0 || workoutProgress.total > 0) && (
          <View style={s.progressSection}>
            {dailyProgress.total > 0 && (
              <View style={s.progressRow}>
                <PillIcon size={14} color={colors.primary} />
                <Text style={s.progressLabel}>Daily</Text>
                <View style={s.progressBarTrack}>
                  <View
                    style={[
                      s.progressBarFill,
                      {
                        width: `${Math.round((dailyProgress.completed / dailyProgress.total) * 100)}%`,
                      },
                      dailyProgress.completed === dailyProgress.total && s.progressBarComplete,
                    ]}
                  />
                </View>
              </View>
            )}
            {weeklyProgress.total > 0 && (
              <View style={s.progressRow}>
                <PillIcon size={14} color="#F59E0B" />
                <Text style={s.progressLabel}>Weekly</Text>
                <View style={s.progressBarTrack}>
                  <View
                    style={[
                      s.progressBarFillWeekly,
                      {
                        width: `${Math.round((weeklyProgress.completed / weeklyProgress.total) * 100)}%`,
                      },
                      weeklyProgress.completed === weeklyProgress.total && s.progressBarComplete,
                    ]}
                  />
                </View>
              </View>
            )}
            {workoutProgress.total > 0 && (
              <View style={s.progressRow}>
                <DumbbellIcon size={14} color="#7C3AED" strokeWidth={2} />
                <Text style={s.progressLabel}>Workout</Text>
                <View style={s.progressBarTrack}>
                  <View
                    style={[
                      s.progressBarFillWorkout,
                      {
                        width: `${Math.round((workoutProgress.completed / workoutProgress.total) * 100)}%`,
                      },
                      workoutProgress.completed === workoutProgress.total && s.progressBarComplete,
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Calendar */}
        <CalendarGrid
          year={year}
          month={month}
          statuses={statuses}
          onDayPress={handleDayPress}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          colors={colors}
        />

        {/* Action buttons below calendar */}
        <View style={s.actionButtons}>
          <TouchableOpacity
            style={s.addButton}
            onPress={() => navigation.navigate('AddEditSupplement', {})}
            activeOpacity={0.8}
          >
            <PillIcon size={18} color="#FFFFFF" />
            <Text style={s.addButtonText}>+ Add Supplement</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.addButton, s.addWorkoutButton]}
            onPress={() => navigation.navigate('AddEditWorkout', {})}
            activeOpacity={0.8}
          >
            <DumbbellIcon size={18} color="#FFFFFF" strokeWidth={2} />
            <Text style={s.addButtonText}>+ Add Workout</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Supplements Toggle */}
        {hasAnything && (
          <>
            <TouchableOpacity
              style={s.todaySectionToggle}
              onPress={() => setShowToday(!showToday)}
              activeOpacity={0.7}
            >
              <Text style={s.todaySectionToggleText}>
                {showToday ? 'Hide' : 'Show'} Today's Supplements & Workouts
              </Text>
            </TouchableOpacity>

            {showToday && (
              <View style={s.todaySection}>
                {weeklySups.length > 0 && (
                  <>
                    <View style={s.todaySectionHeaderRow}>
                      <PillIcon size={14} color="#B45309" />
                      <Text style={[s.todaySectionHeader, { color: '#B45309' }]}>
                        Weekly
                      </Text>
                    </View>
                    {weeklySups.map((sup) => {
                      const edges = getSupplementClusterEdges(weeklySups, sup.id);
                      return (
                        <SupplementCard
                          key={sup.id}
                          supplement={sup}
                          doses={getDoses(sup)}
                          onToggleDose={(doseIndex) =>
                            handleToggleDose(sup.id, doseIndex, sup.dosesPerDay)
                          }
                          onEdit={() =>
                            navigation.navigate('AddEditSupplement', { supplement: sup })
                          }
                          onDelete={() => confirmDeleteSupplement(sup)}
                          colors={colors}
                          linkedNames={getLinkedNames(sup, supplementNameMap)}
                          doseSources={doseSourceRecord[sup.id]}
                          supplementNames={supplementNameMap}
                          onMoveUp={() => handleMoveSupplement(sup.id, 'weekly', 'up')}
                          onMoveDown={() => handleMoveSupplement(sup.id, 'weekly', 'down')}
                          canMoveUp={!edges.isFirst}
                          canMoveDown={!edges.isLast}
                        />
                      );
                    })}
                  </>
                )}
                {dailySups.length > 0 && (
                  <>
                    <View
                      style={[
                        s.todaySectionHeaderRow,
                        weeklySups.length > 0 && { marginTop: spacing.md },
                      ]}
                    >
                      <PillIcon size={14} color={colors.primary} />
                      <Text style={s.todaySectionHeader}>Daily</Text>
                    </View>
                    {dailySups.map((sup) => {
                      const edges = getSupplementClusterEdges(dailySups, sup.id);
                      return (
                        <SupplementCard
                          key={sup.id}
                          supplement={sup}
                          doses={getDoses(sup)}
                          onToggleDose={(doseIndex) =>
                            handleToggleDose(sup.id, doseIndex, sup.dosesPerDay)
                          }
                          onEdit={() =>
                            navigation.navigate('AddEditSupplement', { supplement: sup })
                          }
                          onDelete={() => confirmDeleteSupplement(sup)}
                          colors={colors}
                          linkedNames={getLinkedNames(sup, supplementNameMap)}
                          doseSources={doseSourceRecord[sup.id]}
                          supplementNames={supplementNameMap}
                          onMoveUp={() => handleMoveSupplement(sup.id, 'daily', 'up')}
                          onMoveDown={() => handleMoveSupplement(sup.id, 'daily', 'down')}
                          canMoveUp={!edges.isFirst}
                          canMoveDown={!edges.isLast}
                        />
                      );
                    })}
                  </>
                )}
                {todayWorkouts.length > 0 && (
                  <>
                    <View style={[s.todaySectionHeaderRow, { marginTop: spacing.md }]}>
                      <DumbbellIcon size={14} color={colors.textSubtle} strokeWidth={2} />
                      <Text style={s.todaySectionHeader}>Workouts</Text>
                    </View>
                    {todayWorkouts.map((workout, idx) => (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        record={workoutRecord[workout.id]}
                        onSaveNotes={(notes) =>
                          handleSaveWorkoutNotes(workout.id, notes)
                        }
                        onEdit={() =>
                          navigation.navigate('AddEditWorkout', { workout })
                        }
                        onDelete={() => confirmDeleteWorkout(workout)}
                        colors={colors}
                        weekCount={
                          workout.frequency === 'weekly'
                            ? weeklyWorkoutCounts[workout.id] ?? 0
                            : undefined
                        }
                        onIncrementSession={() =>
                          handleIncrementSession(workout.id)
                        }
                        onDecrementSession={() =>
                          handleDecrementSession(workout.id)
                        }
                        lastCompletedDate={lastCompletedDates[workout.id]}
                        onMoveUp={() => handleMoveWorkout(workout.id, 'up')}
                        onMoveDown={() => handleMoveWorkout(workout.id, 'down')}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < todayWorkouts.length - 1}
                      />
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 60,
    },
    pregnancyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      gap: spacing.md,
    },
    pregnancyWeekCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pregnancyWeekNumber: {
      fontSize: fontSize.xl,
      fontWeight: '800',
      color: colors.primary,
      lineHeight: 26,
    },
    pregnancyWeekLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary,
      marginTop: -2,
    },
    pregnancyInfo: {
      flex: 1,
    },
    pregnancyTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    pregnancySubtitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    // Progress bars
    progressSection: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSubtle,
      width: 50,
    },
    progressBarTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.border,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
    },
    progressBarFillWeekly: {
      height: '100%',
      backgroundColor: '#F59E0B',
      borderRadius: borderRadius.full,
    },
    progressBarFillWorkout: {
      height: '100%',
      backgroundColor: '#7C3AED',
      borderRadius: borderRadius.full,
    },
    progressBarComplete: {
      backgroundColor: colors.success,
    },
    // Action buttons
    actionButtons: {
      flexDirection: 'column',
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primaryDark,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    addWorkoutButton: {
      backgroundColor: '#B45309',
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    // Today section toggle
    todaySectionToggle: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    todaySectionToggleText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.primary,
    },
    // Today section content
    todaySection: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    todaySectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    todaySectionHeader: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
}
