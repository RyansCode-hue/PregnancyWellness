import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CalendarGrid from '../components/CalendarGrid';
import SupplementCard from '../components/SupplementCard';
import WorkoutCard from '../components/WorkoutCard';
import { PillIcon, DumbbellIcon, GearIcon } from '../components/Icons';
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
  getDayRecord,
  toggleDose,
  toggleWorkout,
  saveWorkoutNotes,
  formatDate,
  getWeeklySupplementDoses,
  getWorkoutProgress,
  getDoseSourceRecord,
  groupLinkedSupplements,
  DayCombinedStatus,
} from '../storage/storage';
import { RootStackParamList, Supplement, Workout, DayRecord, DoseSourceRecord, WorkoutDayRecord } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

export default function CalendarScreen({ navigation }: Props) {
  const { colors, isDark, settings } = useTheme();
  const s = makeStyles(colors);

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
  const [showToday, setShowToday] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [year, month])
  );

  const loadData = async () => {
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

    // Today's records for inline view — merge weekly supplement doses across the week
    const todayRecord = await getDayRecord(todayStr);
    const weeklyDoses = await getWeeklySupplementDoses(todayStr, sups);
    const mergedRecord: DayRecord = { ...todayRecord };
    for (const supId of Object.keys(weeklyDoses)) {
      mergedRecord[supId] = weeklyDoses[supId];
    }
    setDayRecord(mergedRecord);
    setDoseSourceRecord(await getDoseSourceRecord(todayStr));
    const tw = getWorkoutsForDate(wks, todayStr);
    setTodayWorkouts(tw);
    setWorkoutRecord(await getWorkoutDayRecord(todayStr));
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

  const handleToggleDose = async (supId: string, doseIndex: number, dosesPerDay: number) => {
    const updated = await toggleDose(todayStr, supId, doseIndex, dosesPerDay);
    setDayRecord(updated);
    loadData();
  };

  const handleToggleWorkout = async (workoutId: string) => {
    const updated = await toggleWorkout(todayStr, workoutId);
    setWorkoutRecord(updated);
    loadData();
  };

  const handleSaveWorkoutNotes = async (workoutId: string, notes: string) => {
    const updated = await saveWorkoutNotes(todayStr, workoutId, notes);
    setWorkoutRecord(updated);
  };

  // Pregnancy info
  const pregnancyWeek = settings.dueDate ? getPregnancyWeek(settings.dueDate) : null;
  const daysUntil = settings.dueDate ? getDaysUntilDue(settings.dueDate) : null;

  // Sort supplements: weekly first, then daily — grouped by linked clusters
  const weeklySups = groupLinkedSupplements(supplements.filter((sup) => sup.frequency === 'weekly'));
  const dailySups = groupLinkedSupplements(supplements.filter((sup) => sup.frequency === 'daily'));

  const getDoses = (sup: Supplement): boolean[] => {
    return dayRecord[sup.id] || new Array(sup.dosesPerDay).fill(false);
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

  const hasAnything = supplements.length > 0 || todayWorkouts.length > 0;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView contentContainerStyle={s.scrollContent}>
        {/* App Title + Settings */}
        <View style={s.titleBar}>
          <View style={s.titleLeft}>
            <PillIcon size={28} color={colors.primary} />
            <View>
              <Text style={s.title}>Pregnancy Wellness</Text>
              <Text style={s.subtitle}>Supplement + Workout Tracker</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <GearIcon size={22} color={colors.textSubtle} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

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
                {/* Weekly supplements first */}
                {weeklySups.length > 0 && (
                  <>
                    <View style={s.todaySectionHeaderRow}>
                      <PillIcon size={14} color="#B45309" />
                      <Text style={[s.todaySectionHeader, { color: '#B45309' }]}>Weekly</Text>
                    </View>
                    {weeklySups.map((sup) => (
                      <SupplementCard
                        key={sup.id}
                        supplement={sup}
                        doses={getDoses(sup)}
                        onToggleDose={(doseIndex) =>
                          handleToggleDose(sup.id, doseIndex, sup.dosesPerDay)
                        }
                        onLongPress={() =>
                          navigation.navigate('AddEditSupplement', { supplement: sup })
                        }
                        colors={colors}
                        linkedNames={getLinkedNames(sup)}
                        doseSources={doseSourceRecord[sup.id]}
                        supplementNames={supplementNameMap}
                      />
                    ))}
                  </>
                )}

                {/* Daily supplements */}
                {dailySups.length > 0 && (
                  <>
                    <View style={[s.todaySectionHeaderRow, weeklySups.length > 0 && { marginTop: spacing.md }]}>
                      <PillIcon size={14} color={colors.primary} />
                      <Text style={s.todaySectionHeader}>Daily</Text>
                    </View>
                    {dailySups.map((sup) => (
                      <SupplementCard
                        key={sup.id}
                        supplement={sup}
                        doses={getDoses(sup)}
                        onToggleDose={(doseIndex) =>
                          handleToggleDose(sup.id, doseIndex, sup.dosesPerDay)
                        }
                        onLongPress={() =>
                          navigation.navigate('AddEditSupplement', { supplement: sup })
                        }
                        colors={colors}
                        linkedNames={getLinkedNames(sup)}
                        doseSources={doseSourceRecord[sup.id]}
                        supplementNames={supplementNameMap}
                      />
                    ))}
                  </>
                )}

                {/* Workouts */}
                {todayWorkouts.length > 0 && (
                  <>
                    <View style={[s.todaySectionHeaderRow, { marginTop: spacing.md }]}>
                      <DumbbellIcon size={14} color={colors.textSubtle} strokeWidth={2} />
                      <Text style={s.todaySectionHeader}>Workouts</Text>
                    </View>
                    {todayWorkouts.map((workout) => (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        record={workoutRecord[workout.id]}
                        onToggle={() => handleToggleWorkout(workout.id)}
                        onSaveNotes={(notes) => handleSaveWorkoutNotes(workout.id, notes)}
                        onLongPress={() =>
                          navigation.navigate('AddEditWorkout', { workout })
                        }
                        colors={colors}
                      />
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
    scrollContent: {
      paddingBottom: 60,
    },
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    titleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
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
