import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import {
  getAvailableWeeks,
  getWeeklyReport,
  parseDate,
  formatDate,
  getWeekRange,
  WeeklyReport,
} from '../storage/storage';
import { BackIcon, PillIcon, DumbbellIcon, CheckIcon, XIcon } from '../components/Icons';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WeeklyReport'>;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function weekLabel(startStr: string): string {
  const start = parseDate(startStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sMonth = MONTH_SHORT[start.getMonth()];
  const eMonth = MONTH_SHORT[end.getMonth()];
  if (sMonth === eMonth) {
    return `${sMonth} ${start.getDate()} - ${end.getDate()}`;
  }
  return `${sMonth} ${start.getDate()} - ${eMonth} ${end.getDate()}`;
}

// Check if a week (by its Monday) overlaps with a given month
function weekOverlapsMonth(weekStart: string, year: number, month: number): boolean {
  const start = parseDate(weekStart);
  // A week overlaps a month if any of the 7 days falls in that month
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getFullYear() === year && d.getMonth() === month) return true;
  }
  return false;
}

export default function WeeklyReportScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [allWeeks, setAllWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Picker state
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  // Report
  const [report, setReport] = useState<WeeklyReport | null>(null);

  // Dropdown visibility
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showWeekPicker, setShowWeekPicker] = useState(false);

  useEffect(() => {
    loadWeeks();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadReport(selectedWeek);
    } else {
      setReport(null);
    }
  }, [selectedWeek]);

  const loadWeeks = async () => {
    const available = await getAvailableWeeks();
    setAllWeeks(available);
    setLoading(false);
  };

  const loadReport = async (weekStart: string) => {
    const r = await getWeeklyReport(weekStart);
    setReport(r);
  };

  // Derive available years from weeks
  const yearSet = new Set<number>();
  for (const w of allWeeks) {
    const d = parseDate(w);
    // Check all 7 days — the week might span two years
    for (let i = 0; i < 7; i++) {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      yearSet.add(day.getFullYear());
    }
  }
  const sortedYears = Array.from(yearSet).sort((a, b) => b - a);

  // Derive available months for selected year
  const availableMonths: number[] = [];
  if (selectedYear !== null) {
    const monthSet = new Set<number>();
    const now = new Date();
    for (const w of allWeeks) {
      for (let m = 0; m < 12; m++) {
        if (weekOverlapsMonth(w, selectedYear, m)) {
          // Don't include future months
          if (selectedYear < now.getFullYear() || m <= now.getMonth()) {
            monthSet.add(m);
          }
        }
      }
    }
    availableMonths.push(...Array.from(monthSet).sort((a, b) => a - b));
  }

  // Derive available weeks for selected year + month
  const availableWeeksForMonth: string[] = [];
  if (selectedYear !== null && selectedMonth !== null) {
    for (const w of allWeeks) {
      if (weekOverlapsMonth(w, selectedYear, selectedMonth)) {
        availableWeeksForMonth.push(w);
      }
    }
  }

  const handleSelectYear = (year: number) => {
    setSelectedYear(year);
    setSelectedMonth(null);
    setSelectedWeek(null);
    setShowYearPicker(false);
    setShowMonthPicker(false);
    setShowWeekPicker(false);
  };

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month);
    setSelectedWeek(null);
    setShowMonthPicker(false);
    setShowWeekPicker(false);
  };

  const handleSelectWeek = (week: string) => {
    setSelectedWeek(week);
    setShowWeekPicker(false);
  };

  // Check if selected week is the current week
  const currentMondayStr = getWeekRange(formatDate(new Date())).start;
  const isCurrentWeek = selectedWeek === currentMondayStr;

  // Overall scores
  const supScore = report
    ? report.supplements.reduce((acc, item) => acc + item.completedDoses, 0)
    : 0;
  const supTotal = report
    ? report.supplements.reduce((acc, item) => acc + item.totalDoses, 0)
    : 0;
  const workoutScore = report
    ? report.workouts.reduce((acc, item) => acc + item.completedDays, 0)
    : 0;
  const workoutTotal = report
    ? report.workouts.reduce((acc, item) => acc + item.totalDays, 0)
    : 0;
  const supPct = supTotal > 0 ? Math.round((supScore / supTotal) * 100) : 0;
  const workoutPct = workoutTotal > 0 ? Math.round((workoutScore / workoutTotal) * 100) : 0;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backButton}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <BackIcon size={20} color={colors.primary} strokeWidth={2.5} />
            <Text style={s.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Weekly Report</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {/* Year picker */}
          <Text style={s.pickerLabel}>Year</Text>
          <TouchableOpacity
            style={s.pickerButton}
            onPress={() => {
              setShowYearPicker(!showYearPicker);
              setShowMonthPicker(false);
              setShowWeekPicker(false);
            }}
          >
            <Text style={selectedYear !== null ? s.pickerButtonText : s.pickerButtonPlaceholder}>
              {selectedYear !== null ? String(selectedYear) : 'Select year'}
            </Text>
            <Text style={s.pickerChevron}>{showYearPicker ? '\u25B2' : '\u25BC'}</Text>
          </TouchableOpacity>
          {showYearPicker && (
            <View style={s.dropdown}>
              {sortedYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[s.dropdownItem, selectedYear === year && s.dropdownItemSelected]}
                  onPress={() => handleSelectYear(year)}
                >
                  <Text style={[s.dropdownItemText, selectedYear === year && s.dropdownItemTextSelected]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Month picker */}
          {selectedYear !== null && (
            <>
              <Text style={[s.pickerLabel, { marginTop: spacing.md }]}>Month</Text>
              <TouchableOpacity
                style={s.pickerButton}
                onPress={() => {
                  setShowMonthPicker(!showMonthPicker);
                  setShowYearPicker(false);
                  setShowWeekPicker(false);
                }}
              >
                <Text style={selectedMonth !== null ? s.pickerButtonText : s.pickerButtonPlaceholder}>
                  {selectedMonth !== null ? MONTH_NAMES[selectedMonth] : 'Select month'}
                </Text>
                <Text style={s.pickerChevron}>{showMonthPicker ? '\u25B2' : '\u25BC'}</Text>
              </TouchableOpacity>
              {showMonthPicker && (
                <View style={s.dropdown}>
                  {availableMonths.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[s.dropdownItem, selectedMonth === m && s.dropdownItemSelected]}
                      onPress={() => handleSelectMonth(m)}
                    >
                      <Text style={[s.dropdownItemText, selectedMonth === m && s.dropdownItemTextSelected]}>
                        {MONTH_NAMES[m]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Week picker */}
          {selectedYear !== null && selectedMonth !== null && (
            <>
              <Text style={[s.pickerLabel, { marginTop: spacing.md }]}>Week</Text>
              <TouchableOpacity
                style={s.pickerButton}
                onPress={() => {
                  setShowWeekPicker(!showWeekPicker);
                  setShowYearPicker(false);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={selectedWeek ? s.pickerButtonText : s.pickerButtonPlaceholder}>
                  {selectedWeek
                    ? `${weekLabel(selectedWeek)}${selectedWeek === currentMondayStr ? ' (This week)' : ''}`
                    : 'Select week'}
                </Text>
                <Text style={s.pickerChevron}>{showWeekPicker ? '\u25B2' : '\u25BC'}</Text>
              </TouchableOpacity>
              {showWeekPicker && (
                <View style={s.dropdown}>
                  {availableWeeksForMonth.map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[s.dropdownItem, selectedWeek === w && s.dropdownItemSelected]}
                      onPress={() => handleSelectWeek(w)}
                    >
                      <Text style={[s.dropdownItemText, selectedWeek === w && s.dropdownItemTextSelected]}>
                        {weekLabel(w)}{w === currentMondayStr ? '  (This week)' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Report content */}
          {report && selectedWeek && (
            <View style={s.reportContent}>
              {/* Week title */}
              <Text style={s.reportTitle}>
                {weekLabel(selectedWeek)}
                {isCurrentWeek ? ' (This week)' : ''}
              </Text>

              {/* Overall scores */}
              <View style={s.scoreRow}>
                {supTotal > 0 && (
                  <View style={s.scoreCard}>
                    <PillIcon size={20} color={colors.primary} />
                    <Text style={s.scorePercent}>{supPct}%</Text>
                    <Text style={s.scoreLabel}>Supplements</Text>
                    <View style={s.scoreBarTrack}>
                      <View
                        style={[
                          s.scoreBarFill,
                          { width: `${supPct}%`, backgroundColor: supPct === 100 ? colors.success : colors.primary },
                        ]}
                      />
                    </View>
                  </View>
                )}
                {workoutTotal > 0 && (
                  <View style={s.scoreCard}>
                    <DumbbellIcon size={20} color="#7C3AED" strokeWidth={2} />
                    <Text style={s.scorePercent}>{workoutPct}%</Text>
                    <Text style={s.scoreLabel}>Workouts</Text>
                    <View style={s.scoreBarTrack}>
                      <View
                        style={[
                          s.scoreBarFill,
                          { width: `${workoutPct}%`, backgroundColor: workoutPct === 100 ? colors.success : '#7C3AED' },
                        ]}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Supplement breakdown */}
              {report.supplements.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeaderRow}>
                    <PillIcon size={16} color={colors.primary} />
                    <Text style={s.sectionTitle}>Supplements</Text>
                  </View>
                  {report.supplements.map((sup, idx) => {
                    const pct = sup.totalDoses > 0 ? Math.round((sup.completedDoses / sup.totalDoses) * 100) : 0;
                    const isComplete = sup.completedDoses === sup.totalDoses;
                    const hasBreakdown = sup.sourceBreakdown && sup.sourceBreakdown.length > 1;
                    return (
                      <View key={idx} style={s.reportItem}>
                        <View style={s.reportItemHeader}>
                          <View style={s.reportItemLeft}>
                            {isComplete ? (
                              <View style={[s.statusIcon, { backgroundColor: colors.success }]}>
                                <CheckIcon size={12} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            ) : (
                              <View style={[s.statusIcon, { backgroundColor: colors.danger }]}>
                                <XIcon size={12} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            )}
                            <View>
                              <Text style={s.reportItemName}>{sup.name}</Text>
                              <Text style={s.reportItemFreq}>
                                {sup.frequency === 'weekly' ? 'Weekly' : 'Daily'}
                                {hasBreakdown ? ' · Linked' : ''}
                              </Text>
                            </View>
                          </View>
                          <Text style={[s.reportItemScore, isComplete && { color: colors.success }]}>
                            {sup.completedDoses}/{sup.totalDoses}
                          </Text>
                        </View>
                        <View style={s.reportBarTrack}>
                          <View
                            style={[
                              s.reportBarFill,
                              {
                                width: `${pct}%`,
                                backgroundColor: isComplete ? colors.success : colors.primary,
                              },
                            ]}
                          />
                        </View>

                        {/* Source breakdown for linked supplements */}
                        {hasBreakdown && (
                          <View style={s.breakdownSection}>
                            {sup.sourceBreakdown!.map((src, si) => (
                              <View key={si} style={s.breakdownRow}>
                                <Text style={s.breakdownName}>{src.name}</Text>
                                <Text style={s.breakdownScore}>
                                  {src.completed}/{src.total}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Workout breakdown */}
              {report.workouts.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeaderRow}>
                    <DumbbellIcon size={16} color="#7C3AED" strokeWidth={2} />
                    <Text style={s.sectionTitle}>Workouts</Text>
                  </View>
                  {report.workouts.map((w, idx) => {
                    const pct = w.totalDays > 0 ? Math.round((w.completedDays / w.totalDays) * 100) : 0;
                    const isComplete = w.completedDays === w.totalDays;
                    return (
                      <View key={idx} style={s.reportItem}>
                        <View style={s.reportItemHeader}>
                          <View style={s.reportItemLeft}>
                            {isComplete ? (
                              <View style={[s.statusIcon, { backgroundColor: colors.success }]}>
                                <CheckIcon size={12} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            ) : (
                              <View style={[s.statusIcon, { backgroundColor: colors.danger }]}>
                                <XIcon size={12} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            )}
                            <View>
                              <Text style={s.reportItemName}>{w.name}</Text>
                              <Text style={s.reportItemFreq}>
                                {w.frequency === 'weekly'
                                  ? `Weekly goal · ${w.totalDays}× per week`
                                  : `${w.totalDays} day${w.totalDays !== 1 ? 's' : ''} this week`}
                              </Text>
                            </View>
                          </View>
                          <Text style={[s.reportItemScore, isComplete && { color: colors.success }]}>
                            {w.completedDays}/{w.totalDays}
                          </Text>
                        </View>
                        <View style={s.reportBarTrack}>
                          <View
                            style={[
                              s.reportBarFill,
                              {
                                width: `${pct}%`,
                                backgroundColor: isComplete ? colors.success : '#7C3AED',
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Empty state */}
              {report.supplements.length === 0 && report.workouts.length === 0 && (
                <View style={s.emptyContainer}>
                  <Text style={s.emptyText}>No supplements or workouts tracked this week.</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {},
    backText: {
      fontSize: fontSize.lg,
      color: colors.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: 80,
    },
    // Picker
    pickerLabel: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.textSubtle,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    pickerButtonText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
    pickerButtonPlaceholder: {
      fontSize: fontSize.md,
      color: colors.checkboxEmpty,
    },
    pickerChevron: {
      fontSize: 12,
      color: colors.textSubtle,
    },
    dropdown: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    dropdownItem: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemSelected: {
      backgroundColor: colors.primaryLight,
    },
    dropdownItemText: {
      fontSize: fontSize.md,
      color: colors.text,
    },
    dropdownItemTextSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    // Report content
    reportContent: {
      marginTop: spacing.lg,
    },
    reportTitle: {
      fontSize: fontSize.xl,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    // Score cards
    scoreRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    scoreCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
    },
    scorePercent: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
    },
    scoreLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    scoreBarTrack: {
      width: '100%',
      height: 6,
      backgroundColor: colors.border,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    scoreBarFill: {
      height: '100%',
      borderRadius: borderRadius.full,
    },
    // Sections
    section: {
      marginBottom: spacing.lg,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    // Report items
    reportItem: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    reportItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    reportItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    statusIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportItemName: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
    reportItemFreq: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 1,
    },
    reportItemScore: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    reportBarTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    reportBarFill: {
      height: '100%',
      borderRadius: borderRadius.full,
    },
    // Linked breakdown
    breakdownSection: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
      paddingLeft: 36, // indent past the status icon
    },
    breakdownName: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '500',
    },
    breakdownScore: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    // Empty
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl * 2,
    },
    emptyText: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      textAlign: 'center',
    },
  });
}
